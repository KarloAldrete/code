import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { usePushTokenStore } from "@/features/notifications/stores/pushTokenStore";
import { logger } from "@/lib/logger";
import { deleteTaskPresence, postTaskPresence } from "../api";

const log = logger.scope("task-presence");

// Server-side TTL is 60s; refresh well before expiry so the suppression
// window never gaps. Keep it short enough that briefly putting the phone
// down doesn't drop us out of "active" before we re-beacon on resume.
const PRESENCE_REFRESH_INTERVAL_MS = 30_000;

/**
 * Beacons "this device is actively viewing task X" to the server while the
 * task screen is mounted and the app is foregrounded. The server suppresses
 * push fanout to devices with active presence — so opening a task on mobile
 * stops the user's desktop / other phone from also ringing.
 *
 * Behaviour:
 *   - On mount (and on AppState transitions back to "active"): POST.
 *   - Every PRESENCE_REFRESH_INTERVAL_MS while mounted + active: POST again.
 *   - On AppState going inactive/background, on unmount, on taskId change:
 *     DELETE.
 *
 * Failures are intentionally swallowed — this is notification routing, not
 * functional behaviour. Worst case the user gets a duplicate notification.
 */
export function useTaskPresence(taskId: string | null | undefined): void {
  const deviceId = usePushTokenStore((s) => s.deviceId);
  // We also wait for hydration so we don't miss the device_id on a cold
  // start where the screen mounts before SecureStore reads complete.
  const hydrate = usePushTokenStore((s) => s.hydrate);
  const isHydrated = usePushTokenStore((s) => s.isHydrated);

  useEffect(() => {
    if (!isHydrated) {
      hydrate().catch(() => {});
    }
  }, [isHydrated, hydrate]);

  // Stable ref tracking so the active-AppState handler can read the latest
  // taskId/deviceId without resubscribing on every render.
  const currentTaskIdRef = useRef<string | null>(null);
  const deviceIdRef = useRef<string | null>(deviceId);
  deviceIdRef.current = deviceId;

  useEffect(() => {
    if (!taskId || !deviceId) {
      currentTaskIdRef.current = null;
      return;
    }
    currentTaskIdRef.current = taskId;

    let cancelled = false;
    let intervalHandle: ReturnType<typeof setInterval> | null = null;

    const beacon = () => {
      if (cancelled) return;
      postTaskPresence(taskId, deviceId).catch((err) => {
        log.debug("postTaskPresence failed", { taskId, error: err });
      });
    };

    const startBeacon = () => {
      if (intervalHandle) return;
      beacon();
      intervalHandle = setInterval(beacon, PRESENCE_REFRESH_INTERVAL_MS);
    };

    const stopBeacon = (release: boolean) => {
      if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
      }
      if (release) {
        deleteTaskPresence(taskId, deviceId).catch((err) => {
          log.debug("deleteTaskPresence failed", { taskId, error: err });
        });
      }
    };

    if (AppState.currentState === "active") {
      startBeacon();
    }

    const subscription = AppState.addEventListener(
      "change",
      (next: AppStateStatus) => {
        if (next === "active") {
          startBeacon();
        } else {
          stopBeacon(true);
        }
      },
    );

    return () => {
      cancelled = true;
      subscription.remove();
      stopBeacon(true);
    };
  }, [taskId, deviceId]);
}
