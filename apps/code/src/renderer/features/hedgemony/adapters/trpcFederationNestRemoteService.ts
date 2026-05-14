import { trpcClient } from "@renderer/trpc/client";
import type { FederationNestRemoteService } from "../domain/FederationNestRemoteService";

export const trpcFederationNestRemoteService: FederationNestRemoteService = {
  merge(input) {
    return trpcClient.hedgemonyFederation.nests.merge.mutate(input);
  },
  split(input) {
    return trpcClient.hedgemonyFederation.nests.split.mutate(input);
  },
};
