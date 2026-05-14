import type { Proposal } from "@main/services/hedgemony/schemas";

/**
 * Best-effort, single-line evidence summary for a proposal row. The
 * `evidenceJson` blob is producer-versioned — anything inside it might be
 * missing or the wrong shape, so every field is read defensively.
 *
 * Returns `null` if we can't say anything useful; the caller can hide the
 * evidence line entirely rather than render a placeholder.
 */
export function formatProposalEvidence(proposal: Proposal): string | null {
  const raw = safeParse(proposal.evidenceJson);
  if (!raw) return defaultEvidence(proposal);

  switch (proposal.kind) {
    case "merge":
      return mergeEvidence(raw) ?? defaultEvidence(proposal);
    case "split":
      return splitEvidence(raw) ?? defaultEvidence(proposal);
    case "bridge":
      return bridgeEvidence(raw) ?? defaultEvidence(proposal);
    case "forward":
      return forwardEvidence(raw) ?? defaultEvidence(proposal);
    case "adopt":
      return adoptEvidence(raw) ?? defaultEvidence(proposal);
    default:
      return null;
  }
}

function safeParse(json: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }
  return null;
}

function defaultEvidence(proposal: Proposal): string | null {
  switch (proposal.kind) {
    case "merge":
      return "Goal overlap detected";
    case "split":
      return "Goal cohesion drifting";
    case "bridge":
      return "Context links suggested";
    case "forward":
      return "Signal matched multiple nests";
    case "adopt":
      return "Wild hoglet matches goal";
    default:
      return null;
  }
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function fmtScore(score: number): string {
  return score.toFixed(2);
}

function mergeEvidence(raw: Record<string, unknown>): string | null {
  const similarity =
    readNumber(raw.similarity) ?? readNumber(raw.goalSimilarity);
  const ticks = readNumber(raw.sustainedTicks) ?? readNumber(raw.ticks);
  if (similarity !== null && ticks !== null) {
    return `Goal similarity ${fmtScore(similarity)} for ${ticks} ticks`;
  }
  if (similarity !== null) return `Goal similarity ${fmtScore(similarity)}`;
  if (raw.prGraphCrosses === true) return "PR graphs cross";
  return null;
}

function splitEvidence(raw: Record<string, unknown>): string | null {
  const cohesion = readNumber(raw.cohesion) ?? readNumber(raw.spread);
  if (cohesion !== null) {
    return `Goal cohesion ${fmtScore(cohesion)}`;
  }
  return null;
}

function bridgeEvidence(raw: Record<string, unknown>): string | null {
  const score = readNumber(raw.score) ?? readNumber(raw.similarity);
  const kind = typeof raw.overlapKind === "string" ? raw.overlapKind : null;
  if (kind && score !== null) {
    return `${humanOverlapKind(kind)} overlap ${fmtScore(score)}`;
  }
  if (kind) return `${humanOverlapKind(kind)} overlap`;
  if (score !== null) return `Overlap score ${fmtScore(score)}`;
  return null;
}

function forwardEvidence(raw: Record<string, unknown>): string | null {
  const winner = readNumber(raw.winnerScore);
  const runnerUp = readNumber(raw.runnerUpScore) ?? readNumber(raw.score);
  if (winner !== null && runnerUp !== null) {
    return `Signal scored ${fmtScore(winner)} and ${fmtScore(runnerUp)} in two nests`;
  }
  if (runnerUp !== null) return `Signal also matched at ${fmtScore(runnerUp)}`;
  return null;
}

function adoptEvidence(raw: Record<string, unknown>): string | null {
  const affinity = readNumber(raw.affinity) ?? readNumber(raw.score);
  if (affinity !== null) {
    return `Goal affinity ${fmtScore(affinity)}`;
  }
  return null;
}

function humanOverlapKind(kind: string): string {
  switch (kind) {
    case "goal_embedding":
      return "Goal";
    case "pr_graph":
      return "PR graph";
    case "signal_runnerup":
      return "Signal";
    case "scratchpad":
      return "Scratchpad";
    case "chat_xref":
      return "Chat";
    default:
      return kind;
  }
}
