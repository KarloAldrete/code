import { trpcClient } from "@renderer/trpc/client";
import type { HogletRemoteService } from "../domain/HogletRemoteService";

export const trpcHogletRemoteService: HogletRemoteService = {
  adopt(input) {
    return trpcClient.rts.hoglets.adopt.mutate(input);
  },
  release(input) {
    return trpcClient.rts.hoglets.release.mutate(input);
  },
  list(input) {
    return trpcClient.rts.hoglets.list.query(input);
  },
  watch(scope, callbacks) {
    return trpcClient.rts.hoglets.watch.subscribe(scope, {
      onData: callbacks.onData,
      onError: callbacks.onError,
    });
  },
};
