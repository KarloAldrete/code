import { trpcClient } from "@renderer/trpc/client";
import type { PrGraphRemoteService } from "../domain/PrGraphRemoteService";

export const trpcPrGraphRemoteService: PrGraphRemoteService = {
  listForNest(nestId) {
    return trpcClient.rts.prGraph.listForNest.query({ nestId });
  },
  watch(nestId, callbacks) {
    return trpcClient.rts.prGraph.watch.subscribe(
      { id: nestId },
      {
        onData: callbacks.onData,
        onError: callbacks.onError,
      },
    );
  },
};
