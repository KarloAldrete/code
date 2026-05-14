import type { BridgeRepository } from "../domain/BridgeRepository";
import { useFederationStore } from "../stores/federationStore";

export const zustandBridgeRepository: BridgeRepository = {
  upsert(bridge) {
    useFederationStore.getState().upsertBridge(bridge);
  },
  remove(id) {
    useFederationStore.getState().removeBridge(id);
  },
  setAll(bridges) {
    useFederationStore.getState().setBridges(bridges);
  },
  list() {
    return Object.values(useFederationStore.getState().bridgesById);
  },
  listForNest(nestId) {
    return Object.values(useFederationStore.getState().bridgesById).filter(
      (b) =>
        b.removedAt === null && (b.nestAId === nestId || b.nestBId === nestId),
    );
  },
  subscribeToKeys(listener) {
    return useFederationStore.subscribe((state, prev) => {
      const current = new Set(Object.keys(state.bridgesById));
      const previous = new Set(Object.keys(prev.bridgesById));
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
