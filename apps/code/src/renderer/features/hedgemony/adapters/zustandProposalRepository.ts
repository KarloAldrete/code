import type { ProposalRepository } from "../domain/ProposalRepository";
import { useFederationStore } from "../stores/federationStore";

export const zustandProposalRepository: ProposalRepository = {
  upsert(proposal) {
    useFederationStore.getState().upsertProposal(proposal);
  },
  remove(id) {
    useFederationStore.getState().removeProposal(id);
  },
  setAll(proposals) {
    useFederationStore.getState().setProposals(proposals);
  },
  list() {
    return Object.values(useFederationStore.getState().proposalsById);
  },
  get(id) {
    return useFederationStore.getState().proposalsById[id] ?? null;
  },
  subscribeToKeys(listener) {
    return useFederationStore.subscribe((state, prev) => {
      const current = new Set(Object.keys(state.proposalsById));
      const previous = new Set(Object.keys(prev.proposalsById));
      const added: string[] = [];
      const removed: string[] = [];
      for (const id of current) if (!previous.has(id)) added.push(id);
      for (const id of previous) if (!current.has(id)) removed.push(id);
      if (added.length > 0 || removed.length > 0) {
        listener(added, removed);
      }
    });
  },
};
