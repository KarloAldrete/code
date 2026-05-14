import type { PrGraphWatchEvent } from "@main/services/hedgemony/schemas";
import { trpcClient } from "@renderer/trpc/client";
import { logger } from "@utils/logger";
import { usePrGraphStore } from "../stores/prGraphStore";

const log = logger.scope("pr-graph-subscription-service");

type WatchHandle = { unsubscribe: () => void };

function applyWatchEvent(nestId: string, event: PrGraphWatchEvent): void {
  const store = usePrGraphStore.getState();
  if (event.kind === "upsert") store.upsert(nestId, event.edge);
  else store.remove(nestId, event.edgeId);
}

/**
 * Bootstraps PR-graph edges for a single nest: fetches the current edge list,
 * opens a watch subscription, and returns a disposer.
 *
 * Mounted from `HedgemonyMapView` (or `NestBroodCluster`) per active nest so
 * detail panels and sprite badges can read edges out of `usePrGraphStore`
 * without orchestrating their own fetch lifecycle.
 */
export function initializePrGraphForNest(nestId: string): () => void {
  let disposed = false;
  let initialLoaded = false;
  const buffered: PrGraphWatchEvent[] = [];

  const watch: WatchHandle = trpcClient.hedgemony.prGraph.watch.subscribe(
    { id: nestId },
    {
      onData: (event) => {
        if (disposed) return;
        if (!initialLoaded) {
          buffered.push(event);
          return;
        }
        applyWatchEvent(nestId, event);
      },
      onError: (error) =>
        log.error("pr-graph watch subscription error", { nestId, error }),
    },
  );

  trpcClient.hedgemony.prGraph.listForNest
    .query({ nestId })
    .then((edges) => {
      if (disposed) return;
      usePrGraphStore.getState().setForNest(nestId, edges);
      // Replay any events that arrived between subscribe and list-resolve so
      // upserts/removes don't get clobbered by the initial seed.
      for (const event of buffered) applyWatchEvent(nestId, event);
      buffered.length = 0;
      initialLoaded = true;
    })
    .catch((error) =>
      log.error("Failed to load nest pr-graph edges", { nestId, error }),
    );

  return () => {
    if (disposed) return;
    disposed = true;
    watch.unsubscribe();
  };
}
