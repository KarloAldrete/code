import { trpcClient } from "@renderer/trpc/client";
import type { NestRemoteService } from "../domain/NestRemoteService";

export const trpcNestRemoteService: NestRemoteService = {
  update(input) {
    return trpcClient.rts.nests.update.mutate(input);
  },
  list() {
    return trpcClient.rts.nests.list.query();
  },
  watch(id, callbacks) {
    return trpcClient.rts.nests.watch.subscribe(
      { id },
      {
        onData: callbacks.onData,
        onError: callbacks.onError,
      },
    );
  },
};
