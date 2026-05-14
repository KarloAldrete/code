import type {
  OverlapWatchEvent,
  ProposalWatchEvent,
} from "@main/services/hedgemony/schemas";
import { logger } from "@utils/logger";
import { trpcBridgeRemoteService } from "../adapters/trpcBridgeRemoteService";
import { trpcOverlapRemoteService } from "../adapters/trpcOverlapRemoteService";
import { trpcProposalRemoteService } from "../adapters/trpcProposalRemoteService";
import { useFederationStore } from "../stores/federationStore";

const log = logger.scope("federation-subscription-service");

let refCount = 0;
let activeDispose: (() => void) | null = null;

/**
 * Bootstraps the federation store: opens watch subscriptions for proposals
 * and overlaps, hydrates the proposal/overlap/bridge lists, and returns a
 * disposer. Mirrors `initializeNestStore` — events that arrive between
 * `subscribe` and `list` resolving are buffered and replayed after the
 * initial seed so upserts/removes don't get clobbered.
 *
 * Bridges have no watch channel on the federation router (mutations are
 * authoritative on their own response), so we hydrate via `list` only and
 * rely on action wrappers to call `upsertBridge` / `removeBridge` after
 * create/remove.
 *
 * Ref-counted: multiple `useFederation` consumers share a single pair of
 * watch subscriptions. The underlying transports are torn down once the
 * last consumer unmounts.
 */
export function initializeFederationStore(): () => void {
  refCount += 1;
  if (refCount === 1) {
    activeDispose = openSubscriptions();
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    refCount -= 1;
    if (refCount === 0 && activeDispose) {
      activeDispose();
      activeDispose = null;
    }
  };
}

function openSubscriptions(): () => void {
  let disposed = false;
  let initialProposalsLoaded = false;
  let initialOverlapsLoaded = false;
  const bufferedProposals: ProposalWatchEvent[] = [];
  const bufferedOverlaps: OverlapWatchEvent[] = [];

  const proposalWatch = trpcProposalRemoteService.watch({
    onData: (event) => {
      if (disposed) return;
      if (!initialProposalsLoaded) {
        bufferedProposals.push(event);
        return;
      }
      useFederationStore.getState().applyProposalEvent(event);
    },
    onError: (error) =>
      log.error("proposal watch subscription error", { error }),
  });

  const overlapWatch = trpcOverlapRemoteService.watch({
    onData: (event) => {
      if (disposed) return;
      if (!initialOverlapsLoaded) {
        bufferedOverlaps.push(event);
        return;
      }
      useFederationStore.getState().applyOverlapEvent(event);
    },
    onError: (error) =>
      log.error("overlap watch subscription error", { error }),
  });

  trpcProposalRemoteService
    .list()
    .then((proposals) => {
      if (disposed) return;
      useFederationStore.getState().setProposals(proposals);
      for (const event of bufferedProposals) {
        useFederationStore.getState().applyProposalEvent(event);
      }
      bufferedProposals.length = 0;
      initialProposalsLoaded = true;
    })
    .catch((error) => log.error("Failed to load proposals", { error }));

  trpcOverlapRemoteService
    .list()
    .then((overlaps) => {
      if (disposed) return;
      useFederationStore.getState().setOverlaps(overlaps);
      for (const event of bufferedOverlaps) {
        useFederationStore.getState().applyOverlapEvent(event);
      }
      bufferedOverlaps.length = 0;
      initialOverlapsLoaded = true;
    })
    .catch((error) => log.error("Failed to load overlaps", { error }));

  trpcBridgeRemoteService
    .list()
    .then((bridges) => {
      if (disposed) return;
      useFederationStore.getState().setBridges(bridges);
    })
    .catch((error) => log.error("Failed to load bridges", { error }));

  return () => {
    if (disposed) return;
    disposed = true;
    proposalWatch.unsubscribe();
    overlapWatch.unsubscribe();
  };
}
