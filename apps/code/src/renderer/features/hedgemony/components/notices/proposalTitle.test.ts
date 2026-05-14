import type { Nest, Proposal } from "@main/services/hedgemony/schemas";
import { describe, expect, it } from "vitest";
import { formatProposalTitle } from "./proposalTitle";

function makeNest(id: string, name: string): Nest {
  return {
    id,
    name,
    goalPrompt: "",
    definitionOfDone: null,
    mapX: 0,
    mapY: 0,
    status: "active",
    health: "ok",
    targetMetricId: null,
    loadoutJson: null,
    primaryRepository: null,
    mergedIntoId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

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

describe("formatProposalTitle", () => {
  const nestsById = {
    "nest-a": makeNest("nest-a", "Search"),
    "nest-b": makeNest("nest-b", "Indexer"),
  };

  it("formats a merge title with both nests", () => {
    expect(
      formatProposalTitle(makeProposal({ kind: "merge" }), nestsById),
    ).toBe("Merge Indexer into Search");
  });

  it("formats a split title with just the primary nest", () => {
    expect(
      formatProposalTitle(makeProposal({ kind: "split" }), nestsById),
    ).toBe("Split Search");
  });

  it("formats a bridge title with both nests", () => {
    expect(
      formatProposalTitle(makeProposal({ kind: "bridge" }), nestsById),
    ).toBe("Bridge Search with Indexer");
  });

  it("formats a forward title with the destination nest", () => {
    expect(
      formatProposalTitle(makeProposal({ kind: "forward" }), nestsById),
    ).toBe("Forward signal to Search");
  });

  it("formats an adopt title with the destination nest", () => {
    expect(
      formatProposalTitle(makeProposal({ kind: "adopt" }), nestsById),
    ).toBe("Adopt wild hoglet into Search");
  });

  it("falls back to a short id when a referenced nest is missing", () => {
    const proposal = makeProposal({
      kind: "merge",
      primaryNestId: "abcdef1234",
      secondaryNestId: null,
    });
    expect(formatProposalTitle(proposal, {})).toBe(
      "Merge a nest into nest abcdef",
    );
  });
});
