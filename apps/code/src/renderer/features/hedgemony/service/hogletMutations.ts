import type { Hoglet } from "@main/services/hedgemony/schemas";
import { trpcClient } from "@renderer/trpc/client";
import { ANALYTICS_EVENTS } from "@shared/types/analytics";
import { track } from "@utils/analytics";
import { logger } from "@utils/logger";
import { toast } from "sonner";
import { useHogletPositionStore } from "../stores/hogletPositionStore";
import {
  SIGNAL_STAGING_BUCKET,
  useHogletStore,
  WILD_BUCKET,
} from "../stores/hogletStore";

const log = logger.scope("hoglet-mutations");

export type HogletSourceBucket = "wild" | "signal_staging";

export interface HogletDragSource {
  type?: string;
  hogletId?: string;
  sourceNestId?: string | null;
  sourceBucket?: HogletSourceBucket;
}

export interface HogletDragTarget {
  type?: string;
  nestId?: string;
}

/**
 * Optimistic move from a non-nest bucket (wild or signal_staging) into a nest.
 * Snaps the hoglet's standalone position override so it joins the nest's orbit.
 * Rolls back the bucket move on RPC failure.
 */
export async function adoptHoglet(
  hogletId: string,
  nestId: string,
  sourceBucket: HogletSourceBucket | undefined,
  trackSource: "wild" | "signal",
): Promise<void> {
  const bucketKey =
    sourceBucket === "signal_staging" ? SIGNAL_STAGING_BUCKET : WILD_BUCKET;
  const store = useHogletStore.getState();
  const original = store.byBucket[bucketKey]?.find((h) => h.id === hogletId);
  if (!original) {
    log.warn("Adopt: source hoglet not found in source bucket", {
      hogletId,
      bucketKey,
    });
    return;
  }

  const optimistic: Hoglet = {
    ...original,
    nestId,
    updatedAt: new Date().toISOString(),
  };
  store.remove(bucketKey, hogletId);
  store.upsert(nestId, optimistic);
  useHogletPositionStore.getState().clearPosition(hogletId);

  try {
    const updated = await trpcClient.hedgemony.hoglets.adopt.mutate({
      hogletId,
      nestId,
    });
    useHogletStore.getState().upsert(nestId, updated);
    track(ANALYTICS_EVENTS.HEDGEMONY_HOGLET_ADOPTED, { source: trackSource });
  } catch (error) {
    log.error("Failed to adopt hoglet", { hogletId, nestId, error });
    const current = useHogletStore.getState();
    current.remove(nestId, hogletId);
    current.upsert(bucketKey, original);
    toast.error("Could not adopt hoglet");
  }
}

/**
 * Optimistic move from a nest bucket back to its origin bucket: signal-backed
 * hoglets return to signal_staging, ad-hoc ones return to wild. Rolls back on
 * RPC failure. Mirrors the server-side routing in HogletService.release.
 */
export async function releaseHoglet(
  hogletId: string,
  sourceNestId: string,
): Promise<void> {
  const store = useHogletStore.getState();
  const original = store.byBucket[sourceNestId]?.find((h) => h.id === hogletId);
  if (!original) {
    log.warn("Release: source hoglet not found in nest bucket", {
      hogletId,
      sourceNestId,
    });
    return;
  }

  const destinationBucket =
    original.signalReportId !== null ? SIGNAL_STAGING_BUCKET : WILD_BUCKET;
  const optimistic: Hoglet = {
    ...original,
    nestId: null,
    updatedAt: new Date().toISOString(),
  };
  store.remove(sourceNestId, hogletId);
  store.upsert(destinationBucket, optimistic);
  useHogletPositionStore.getState().clearPosition(hogletId);

  try {
    const updated = await trpcClient.hedgemony.hoglets.release.mutate({
      hogletId,
    });
    useHogletStore.getState().upsert(destinationBucket, updated);
    track(ANALYTICS_EVENTS.HEDGEMONY_HOGLET_RELEASED, { source: "nest" });
  } catch (error) {
    log.error("Failed to release hoglet", {
      hogletId,
      sourceNestId,
      error,
    });
    const current = useHogletStore.getState();
    current.remove(destinationBucket, hogletId);
    current.upsert(sourceNestId, original);
    toast.error("Could not release hoglet");
  }
}

/**
 * Resolves a hoglet drag-end into a mutation. Encapsulates the rules:
 * - dragging onto a nest adopts (only from wild/staging — re-homing across
 *   nests must release-then-adopt)
 * - dragging onto "wild" releases nest-held hoglets back to their origin
 *   bucket (wild for ad-hoc, signal_staging for signal-backed)
 * - dragging onto "signal_staging" follows the same release path; the
 *   bucket is determined by signalReportId, not operator choice
 * Surfaces invalid combinations as toasts and returns without mutating.
 */
export function handleHogletDrop(
  source: HogletDragSource | undefined,
  target: HogletDragTarget | undefined,
): void {
  if (
    !source ||
    source.type !== "hoglet" ||
    typeof source.hogletId !== "string"
  ) {
    return;
  }
  const { hogletId, sourceNestId = null, sourceBucket } = source;

  if (target?.type === "nest" && target.nestId) {
    if (sourceNestId !== null) {
      toast.error("Release this hoglet to wild before adopting it elsewhere");
      return;
    }
    const adoptedFrom: "wild" | "signal" =
      sourceBucket === "signal_staging" ? "signal" : "wild";
    void adoptHoglet(hogletId, target.nestId, sourceBucket, adoptedFrom);
    return;
  }

  if (target?.type === "wild") {
    if (sourceNestId === null) {
      if (sourceBucket === "signal_staging") {
        toast.error(
          "Signal hoglets can't move to wild — drop on a nest or use Dismiss",
        );
      }
      return;
    }
    void releaseHoglet(hogletId, sourceNestId);
    return;
  }

  if (target?.type === "signal_staging") {
    if (sourceNestId === null) {
      if (sourceBucket === "wild") {
        toast.error("Wild hoglets can't become signal-staged");
      }
      return;
    }
    void releaseHoglet(hogletId, sourceNestId);
  }
}
