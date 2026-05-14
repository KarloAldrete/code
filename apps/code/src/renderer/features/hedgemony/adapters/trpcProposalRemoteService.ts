import { trpcClient } from "@renderer/trpc/client";
import type { ProposalRemoteService } from "../domain/ProposalRemoteService";

export const trpcProposalRemoteService: ProposalRemoteService = {
  list(input) {
    return trpcClient.hedgemonyFederation.proposals.list.query(input);
  },
  accept(input) {
    return trpcClient.hedgemonyFederation.proposals.accept.mutate(input);
  },
  dismiss(input) {
    return trpcClient.hedgemonyFederation.proposals.dismiss.mutate(input);
  },
  snooze(input) {
    return trpcClient.hedgemonyFederation.proposals.snooze.mutate(input);
  },
  watch(callbacks) {
    return trpcClient.hedgemonyFederation.proposals.watch.subscribe(undefined, {
      onData: callbacks.onData,
      onError: callbacks.onError,
    });
  },
};
