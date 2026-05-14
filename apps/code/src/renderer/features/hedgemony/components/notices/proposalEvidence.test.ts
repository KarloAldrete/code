import type { Proposal } from "@main/services/hedgemony/schemas";
import { describe, expect, it } from "vitest";
import { formatProposalEvidence } from "./proposalEvidence";

function makeProposal(overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: "p1",
    kind: "merge",
    primaryNestId: "nest-a",
    secondaryNestId: "nest-b",
    hogletId: null,
    signalReportId: null,
    evidenceJson: "{}",
    status: "open",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    resolvedAt: null,
    ...overrides,
  };
}

describe("formatProposalEvidence", () => {
  it("formats a merge similarity + ticks blob", () => {
    const proposal = makeProposal({
      kind: "merge",
      evidenceJson: JSON.stringify({ similarity: 0.84, sustainedTicks: 6 }),
    });
    expect(formatProposalEvidence(proposal)).toBe(
      "Goal similarity 0.84 for 6 ticks",
    );
  });

  it("falls back to a default for merge with unparseable JSON", () => {
    const proposal = makeProposal({
      kind: "merge",
      evidenceJson: "not json at all",
    });
    expect(formatProposalEvidence(proposal)).toBe("Goal overlap detected");
  });

  it("falls back to a default for forward when fields are missing", () => {
    const proposal = makeProposal({
      kind: "forward",
      evidenceJson: "{}",
    });
    expect(formatProposalEvidence(proposal)).toBe(
      "Signal matched multiple nests",
    );
  });

  it("formats a forward with winner and runner-up scores", () => {
    const proposal = makeProposal({
      kind: "forward",
      evidenceJson: JSON.stringify({ winnerScore: 0.91, runnerUpScore: 0.79 }),
    });
    expect(formatProposalEvidence(proposal)).toBe(
      "Signal scored 0.91 and 0.79 in two nests",
    );
  });

  it("formats an adopt affinity score", () => {
    const proposal = makeProposal({
      kind: "adopt",
      evidenceJson: JSON.stringify({ affinity: 0.77 }),
    });
    expect(formatProposalEvidence(proposal)).toBe("Goal affinity 0.77");
  });

  it("formats a bridge with kind and score", () => {
    const proposal = makeProposal({
      kind: "bridge",
      evidenceJson: JSON.stringify({
        overlapKind: "pr_graph",
        score: 0.66,
      }),
    });
    expect(formatProposalEvidence(proposal)).toBe("PR graph overlap 0.66");
  });

  it("ignores arrays in the JSON payload", () => {
    const proposal = makeProposal({
      kind: "merge",
      evidenceJson: JSON.stringify([1, 2, 3]),
    });
    expect(formatProposalEvidence(proposal)).toBe("Goal overlap detected");
  });
});
