import type { OverlapRepository } from "../domain/OverlapRepository";
import { useFederationStore } from "../stores/federationStore";

export const zustandOverlapRepository: OverlapRepository = {
  upsert(overlap) {
    useFederationStore.getState().upsertOverlap(overlap);
  },
  resolve(id) {
    useFederationStore.getState().resolveOverlap(id);
  },
  setAll(overlaps) {
    useFederationStore.getState().setOverlaps(overlaps);
  },
  list() {
    return Object.values(useFederationStore.getState().overlapsById);
  },
  listForPair(nestAId, nestBId) {
    return Object.values(useFederationStore.getState().overlapsById).filter(
      (o) =>
        (o.nestAId === nestAId && o.nestBId === nestBId) ||
        (o.nestAId === nestBId && o.nestBId === nestAId),
    );
  },
  subscribeToKeys(listener) {
    return useFederationStore.subscribe((state, prev) => {
      const current = new Set(Object.keys(state.overlapsById));
      const previous = new Set(Object.keys(prev.overlapsById));
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
