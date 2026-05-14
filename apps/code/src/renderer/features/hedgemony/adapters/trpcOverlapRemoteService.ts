import { trpcClient } from "@renderer/trpc/client";
import type { OverlapRemoteService } from "../domain/OverlapRemoteService";

export const trpcOverlapRemoteService: OverlapRemoteService = {
  list() {
    return trpcClient.hedgemonyFederation.overlaps.list.query();
  },
  watch(callbacks) {
    return trpcClient.hedgemonyFederation.overlaps.watch.subscribe(undefined, {
      onData: callbacks.onData,
      onError: callbacks.onError,
    });
  },
};
