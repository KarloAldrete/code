import type {
  Bridge,
  CreateBridgeInput,
  MergeNestsInput,
  Overlap,
  Proposal,
  SplitNestInput,
} from "@main/services/hedgemony/schemas";
import { logger } from "@utils/logger";
import { useCallback, useEffect } from "react";
import { trpcBridgeRemoteService } from "../adapters/trpcBridgeRemoteService";
import { trpcFederationNestRemoteService } from "../adapters/trpcFederationNestRemoteService";
import { trpcProposalRemoteService } from "../adapters/trpcProposalRemoteService";
import type {
  MergeNestsResult,
  SplitNestResult,
} from "../domain/FederationNestRemoteService";
import { initializeFederationStore } from "../service/federationSubscriptionService";
import {
  selectBridgesForNest,
  selectOpenProposals,
  selectOverlapsForNest,
  selectUnreadCount,
  useFederationStore,
} from "../stores/federationStore";

const log = logger.scope("use-federation");

export interface UseFederationOptions {
  /**
   * When set, restricts `overlapsForNest` / `bridgesForNest` to a single nest.
   * Leave undefined for callers that want the full open sets (e.g. the
   * Builder Notices tab).
   */
  scopeNestId?: string;
}

export interface UseFederationApi {
  openProposals: Proposal[];
  unreadCount: number;
  overlapsForNest: Overlap[];
  bridgesForNest: Bridge[];
  overlayVisible: boolean;
  acceptProposal: (id: string) => Promise<Proposal>;
  dismissProposal: (id: string) => Promise<Proposal>;
  snoozeProposal: (id: string) => Promise<Proposal>;
  createBridge: (input: CreateBridgeInput) => Promise<Bridge>;
  removeBridge: (id: string) => Promise<void>;
  mergeNests: (input: MergeNestsInput) => Promise<MergeNestsResult>;
  splitNest: (input: SplitNestInput) => Promise<SplitNestResult>;
  toggleOverlay: () => void;
  markNoticesRead: () => void;
}

/**
 * Thin consumer for the federation surface. Mounts the subscription service
 * once on the first call (subsequent calls in the same tree re-use the live
 * subscriptions via the store), exposes the cached state via selectors, and
 * returns action wrappers that call the tRPC adapters.
 *
 * Actions do NOT optimistically mutate the store — the proposal/overlap
 * watch streams are authoritative. Bridges have no watch channel, so the
 * `create` / `remove` wrappers update the store with the server's response
 * after the mutation resolves.
 */
export function useFederation(
  options: UseFederationOptions = {},
): UseFederationApi {
  const { scopeNestId } = options;

  useEffect(() => initializeFederationStore(), []);

  const openProposals = useFederationStore(selectOpenProposals);
  const unreadCount = useFederationStore(selectUnreadCount);
  const overlayVisible = useFederationStore((s) => s.overlayVisible);
  const setOverlayVisible = useFederationStore((s) => s.setOverlayVisible);
  const markNoticesReadAction = useFederationStore((s) => s.markNoticesRead);
  const upsertBridge = useFederationStore((s) => s.upsertBridge);
  const removeBridgeFromStore = useFederationStore((s) => s.removeBridge);

  const overlapsForNest = useFederationStore(
    scopeNestId ? selectOverlapsForNest(scopeNestId) : selectEmptyOverlaps,
  );
  const bridgesForNest = useFederationStore(
    scopeNestId ? selectBridgesForNest(scopeNestId) : selectEmptyBridges,
  );

  const acceptProposal = useCallback(
    (id: string) => trpcProposalRemoteService.accept({ id }),
    [],
  );
  const dismissProposal = useCallback(
    (id: string) => trpcProposalRemoteService.dismiss({ id }),
    [],
  );
  const snoozeProposal = useCallback(
    (id: string) => trpcProposalRemoteService.snooze({ id }),
    [],
  );

  const createBridge = useCallback(
    async (input: CreateBridgeInput) => {
      const created = await trpcBridgeRemoteService.create(input);
      upsertBridge(created);
      return created;
    },
    [upsertBridge],
  );

  const removeBridge = useCallback(
    async (id: string) => {
      try {
        await trpcBridgeRemoteService.remove({ id });
        removeBridgeFromStore(id);
      } catch (error) {
        log.error("Failed to remove bridge", { id, error });
        throw error;
      }
    },
    [removeBridgeFromStore],
  );

  const mergeNests = useCallback(
    (input: MergeNestsInput) => trpcFederationNestRemoteService.merge(input),
    [],
  );

  const splitNest = useCallback(
    (input: SplitNestInput) => trpcFederationNestRemoteService.split(input),
    [],
  );

  const toggleOverlay = useCallback(
    () => setOverlayVisible(!overlayVisible),
    [overlayVisible, setOverlayVisible],
  );

  const markNoticesRead = useCallback(
    () => markNoticesReadAction(),
    [markNoticesReadAction],
  );

  return {
    openProposals,
    unreadCount,
    overlapsForNest,
    bridgesForNest,
    overlayVisible,
    acceptProposal,
    dismissProposal,
    snoozeProposal,
    createBridge,
    removeBridge,
    mergeNests,
    splitNest,
    toggleOverlay,
    markNoticesRead,
  };
}

const EMPTY_OVERLAPS: Overlap[] = [];
const EMPTY_BRIDGES: Bridge[] = [];
const selectEmptyOverlaps = (): Overlap[] => EMPTY_OVERLAPS;
const selectEmptyBridges = (): Bridge[] => EMPTY_BRIDGES;
