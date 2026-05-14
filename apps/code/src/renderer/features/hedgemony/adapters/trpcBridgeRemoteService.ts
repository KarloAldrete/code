import { trpcClient } from "@renderer/trpc/client";
import type { BridgeRemoteService } from "../domain/BridgeRepository";

export const trpcBridgeRemoteService: BridgeRemoteService = {
  list(input) {
    return trpcClient.hedgemonyFederation.bridges.list.query(input);
  },
  create(input) {
    return trpcClient.hedgemonyFederation.bridges.create.mutate(input);
  },
  async remove(input) {
    await trpcClient.hedgemonyFederation.bridges.remove.mutate(input);
  },
};
