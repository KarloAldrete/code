import type { Nest, Proposal } from "@main/services/hedgemony/schemas";

/**
 * Resolve a human-readable, single-line title for a proposal row. Falls back
 * to a short id slug when a referenced nest is no longer in the local store
 * (which can happen briefly after a merge or while the nest list is loading).
 */
export function formatProposalTitle(
  proposal: Proposal,
  nestsById: Record<string, Nest>,
): string {
  const primary = nestName(proposal.primaryNestId, nestsById);
  const secondary = nestName(proposal.secondaryNestId, nestsById);

  switch (proposal.kind) {
    case "merge":
      return `Merge ${secondary} into ${primary}`;
    case "split":
      return `Split ${primary}`;
    case "bridge":
      return `Bridge ${primary} with ${secondary}`;
    case "forward":
      return `Forward signal to ${primary}`;
    case "adopt":
      return `Adopt wild hoglet into ${primary}`;
    default:
      return "Builder proposal";
  }
}

function nestName(id: string | null, nestsById: Record<string, Nest>): string {
  if (!id) return "a nest";
  const nest = nestsById[id];
  if (nest) return nest.name;
  return `nest ${id.slice(0, 6)}`;
}
