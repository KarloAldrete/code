import type {
  ListProposalsInput,
  Proposal,
  ProposalIdInput,
  ProposalWatchEvent,
} from "@main/services/hedgemony/schemas";
import type { WatchCallbacks, WatchHandle } from "./NestRemoteService";

/**
 * Narrow interface over the remote proposal API. tRPC is one implementation;
 * tests use fakes.
 */
export interface ProposalRemoteService {
  list(input?: ListProposalsInput): Promise<Proposal[]>;
  accept(input: ProposalIdInput): Promise<Proposal>;
  dismiss(input: ProposalIdInput): Promise<Proposal>;
  snooze(input: ProposalIdInput): Promise<Proposal>;
  watch(callbacks: WatchCallbacks<ProposalWatchEvent>): WatchHandle;
}
