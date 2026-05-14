import type { Proposal } from "@main/services/hedgemony/schemas";

/**
 * Watcher for proposal-set membership transitions. Used by federation
 * subscription orchestration to keep store state in sync as proposals are
 * created, accepted, dismissed, snoozed, or auto-executed.
 */
export type ProposalKeysListener = (added: string[], removed: string[]) => void;

/**
 * Narrow interface over proposal state used by mutations and subscription
 * orchestration. Zustand is one implementation; in-memory fakes drive unit
 * tests.
 */
export interface ProposalRepository {
  upsert(proposal: Proposal): void;
  remove(id: string): void;
  setAll(proposals: Proposal[]): void;
  list(): Proposal[];
  get(id: string): Proposal | null;
  subscribeToKeys(listener: ProposalKeysListener): () => void;
}
