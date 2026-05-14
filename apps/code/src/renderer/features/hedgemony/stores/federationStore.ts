import type {
  Bridge,
  Overlap,
  OverlapWatchEvent,
  Proposal,
  ProposalWatchEvent,
} from "@main/services/hedgemony/schemas";
import { electronStorage } from "@utils/electronStorage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FederationStoreState {
  proposalsById: Record<string, Proposal>;
  overlapsById: Record<string, Overlap>;
  bridgesById: Record<string, Bridge>;
  /**
   * Toggle for the OverlapArcs SVG overlay on the map. Persisted so the
   * operator's preference survives reload — overlaps decay on the main process,
   * so toggling stale state back on is safe.
   */
  overlayVisible: boolean;
  /**
   * Epoch ms the operator last opened the Builder Notices tab. Anything with
   * `createdAt > lastReadAt` is unread. Persisted so the badge doesn't re-fire
   * across reloads.
   */
  lastReadAt: number;
}

interface FederationStoreActions {
  setProposals: (proposals: Proposal[]) => void;
  setOverlaps: (overlaps: Overlap[]) => void;
  setBridges: (bridges: Bridge[]) => void;
  upsertProposal: (proposal: Proposal) => void;
  removeProposal: (id: string) => void;
  upsertOverlap: (overlap: Overlap) => void;
  resolveOverlap: (id: string) => void;
  upsertBridge: (bridge: Bridge) => void;
  removeBridge: (id: string) => void;
  applyProposalEvent: (event: ProposalWatchEvent) => void;
  applyOverlapEvent: (event: OverlapWatchEvent) => void;
  setOverlayVisible: (visible: boolean) => void;
  markNoticesRead: () => void;
}

export type FederationStore = FederationStoreState & FederationStoreActions;

const initialState: FederationStoreState = {
  proposalsById: {},
  overlapsById: {},
  bridgesById: {},
  overlayVisible: false,
  lastReadAt: 0,
};

export const useFederationStore = create<FederationStore>()(
  persist(
    (set) => ({
      ...initialState,

      setProposals: (proposals) =>
        set({
          proposalsById: Object.fromEntries(proposals.map((p) => [p.id, p])),
        }),

      setOverlaps: (overlaps) =>
        set({
          overlapsById: Object.fromEntries(overlaps.map((o) => [o.id, o])),
        }),

      setBridges: (bridges) =>
        set({
          bridgesById: Object.fromEntries(bridges.map((b) => [b.id, b])),
        }),

      upsertProposal: (proposal) =>
        set((state) => ({
          proposalsById: { ...state.proposalsById, [proposal.id]: proposal },
        })),

      removeProposal: (id) =>
        set((state) => {
          if (!(id in state.proposalsById)) return state;
          const next = { ...state.proposalsById };
          delete next[id];
          return { proposalsById: next };
        }),

      upsertOverlap: (overlap) =>
        set((state) => ({
          overlapsById: { ...state.overlapsById, [overlap.id]: overlap },
        })),

      resolveOverlap: (id) =>
        set((state) => {
          const current = state.overlapsById[id];
          if (!current) return state;
          return {
            overlapsById: {
              ...state.overlapsById,
              [id]: {
                ...current,
                resolvedAt: current.resolvedAt ?? new Date().toISOString(),
              },
            },
          };
        }),

      upsertBridge: (bridge) =>
        set((state) => ({
          bridgesById: { ...state.bridgesById, [bridge.id]: bridge },
        })),

      removeBridge: (id) =>
        set((state) => {
          if (!(id in state.bridgesById)) return state;
          const next = { ...state.bridgesById };
          delete next[id];
          return { bridgesById: next };
        }),

      applyProposalEvent: (event) =>
        set((state) => {
          if (event.kind === "upsert") {
            return {
              proposalsById: {
                ...state.proposalsById,
                [event.proposal.id]: event.proposal,
              },
            };
          }
          if (!(event.proposalId in state.proposalsById)) return state;
          const next = { ...state.proposalsById };
          delete next[event.proposalId];
          return { proposalsById: next };
        }),

      applyOverlapEvent: (event) =>
        set((state) => {
          if (event.kind === "upsert") {
            return {
              overlapsById: {
                ...state.overlapsById,
                [event.overlap.id]: event.overlap,
              },
            };
          }
          const current = state.overlapsById[event.overlapId];
          if (!current) return state;
          return {
            overlapsById: {
              ...state.overlapsById,
              [event.overlapId]: {
                ...current,
                resolvedAt: current.resolvedAt ?? new Date().toISOString(),
              },
            },
          };
        }),

      setOverlayVisible: (overlayVisible) => set({ overlayVisible }),

      markNoticesRead: () => set({ lastReadAt: Date.now() }),
    }),
    {
      name: "hedgemony-federation-storage",
      storage: electronStorage,
      // Keyed maps come from subscriptions on every mount — persisting them
      // would surface stale rows the operator can't act on (the server is the
      // source of truth for proposal/overlap/bridge lifecycle).
      partialize: (state) => ({
        overlayVisible: state.overlayVisible,
        lastReadAt: state.lastReadAt,
      }),
    },
  ),
);

export const selectOpenProposals = (state: FederationStore): Proposal[] =>
  Object.values(state.proposalsById)
    .filter((p) => p.status === "open")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

export const selectUnreadCount = (state: FederationStore): number => {
  const cutoff = state.lastReadAt;
  let count = 0;
  for (const p of Object.values(state.proposalsById)) {
    if (p.status !== "open") continue;
    if (Date.parse(p.createdAt) > cutoff) count += 1;
  }
  return count;
};

export const selectOverlapsForNest =
  (nestId: string) =>
  (state: FederationStore): Overlap[] =>
    Object.values(state.overlapsById).filter(
      (o) =>
        o.resolvedAt === null && (o.nestAId === nestId || o.nestBId === nestId),
    );

export const selectBridgesForNest =
  (nestId: string) =>
  (state: FederationStore): Bridge[] =>
    Object.values(state.bridgesById).filter(
      (b) =>
        b.removedAt === null && (b.nestAId === nestId || b.nestBId === nestId),
    );
