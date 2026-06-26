import {
  SESSION_SERVICE,
  type SessionService,
} from "@posthog/core/sessions/sessionService";
import { useService } from "@posthog/di/react";
import { isTerminalStatus } from "@posthog/shared/domain-types";
import { sessionStoreSetters } from "@posthog/ui/features/sessions/sessionStore";
import { useEffect } from "react";

/**
 * How long a transcript can stay unfocused before its in-memory `events` are
 * evicted. The grace window keeps quick back-and-forth navigation cheap (no
 * reload churn) while still bounding resident memory for genuinely idle tasks.
 */
const EVICT_GRACE_MS = 20_000;

/** Pending eviction timers keyed by taskId, shared across hook instances. */
const evictTimers = new Map<string, ReturnType<typeof setTimeout>>();

function cancelPendingEvict(taskId: string): void {
  const timer = evictTimers.get(taskId);
  if (timer) {
    clearTimeout(timer);
    evictTimers.delete(taskId);
  }
}

/**
 * Bounds the memory held by `session.events` (an append-only mirror of the
 * on-disk ndjson) across many open tasks.
 *
 * While a task's transcript is mounted it stays fully resident. On unmount the
 * events are evicted after a grace window — but never for a session that is
 * still streaming (`isPromptPending` / `isCompacting`) or a live cloud run, so
 * background work is never disturbed. On (re)mount the transcript is rehydrated
 * from disk via `ensureEventsLoaded`, which keeps the session warm (subscription
 * and status intact) and no-ops when events are already present.
 *
 * Mechanism + policy validated empirically in `membench/` (~−55% steady-state
 * renderer RAM on a realistic multi-session workload).
 */
export function useSessionEventsResidency(taskId: string): void {
  const sessionService = useService<SessionService>(SESSION_SERVICE);

  useEffect(() => {
    // Focused: cancel any scheduled eviction and restore the transcript.
    cancelPendingEvict(taskId);
    void sessionService.ensureEventsLoaded(taskId);

    return () => {
      // Blurred: schedule eviction after the grace window.
      cancelPendingEvict(taskId);
      const timer = setTimeout(() => {
        evictTimers.delete(taskId);
        const session = sessionStoreSetters.getSessionByTaskId(taskId);
        if (!session || session.events.length === 0) return;
        // Never disturb an in-flight turn, a queued turn about to dispatch, or a
        // live cloud run — any of these can append events while unfocused, which
        // would truncate the transcript (rehydration bails when events exist).
        if (session.isPromptPending || session.isCompacting) return;
        if (session.messageQueue.length > 0) return;
        if (session.isCloud && !isTerminalStatus(session.cloudStatus)) return;
        sessionStoreSetters.evictEvents(session.taskRunId);
      }, EVICT_GRACE_MS);
      evictTimers.set(taskId, timer);
    };
  }, [taskId, sessionService]);
}
