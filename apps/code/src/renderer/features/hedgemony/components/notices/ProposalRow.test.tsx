import type { Nest, Proposal } from "@main/services/hedgemony/schemas";
import { Theme } from "@radix-ui/themes";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProposalRow } from "./ProposalRow";

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
    evidenceJson: JSON.stringify({ similarity: 0.84, sustainedTicks: 6 }),
    status: "open",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    resolvedAt: null,
    ...overrides,
  };
}

type AsyncHandler = (id: string) => Promise<unknown>;

function renderRow(
  proposal: Proposal,
  handlers: {
    onAccept?: AsyncHandler;
    onDismiss?: AsyncHandler;
    onSnooze?: AsyncHandler;
  } = {},
) {
  const nestsById = {
    "nest-a": makeNest("nest-a", "Search"),
    "nest-b": makeNest("nest-b", "Indexer"),
  };
  const onAccept: AsyncHandler =
    handlers.onAccept ?? vi.fn(async () => undefined);
  const onDismiss: AsyncHandler =
    handlers.onDismiss ?? vi.fn(async () => undefined);
  const onSnooze: AsyncHandler =
    handlers.onSnooze ?? vi.fn(async () => undefined);
  render(
    <Theme>
      <ProposalRow
        proposal={proposal}
        nestsById={nestsById}
        onAccept={onAccept}
        onDismiss={onDismiss}
        onSnooze={onSnooze}
      />
    </Theme>,
  );
  return { onAccept, onDismiss, onSnooze };
}

describe("ProposalRow", () => {
  it("renders the merge title with both nest names", () => {
    renderRow(makeProposal({ kind: "merge" }));
    expect(screen.getByText("Merge Indexer into Search")).toBeInTheDocument();
    expect(
      screen.getByText("Goal similarity 0.84 for 6 ticks"),
    ).toBeInTheDocument();
  });

  it("renders the split title with just the primary nest", () => {
    renderRow(
      makeProposal({ kind: "split", evidenceJson: JSON.stringify({}) }),
    );
    expect(screen.getByText("Split Search")).toBeInTheDocument();
  });

  it("renders the bridge title with both nests", () => {
    renderRow(
      makeProposal({ kind: "bridge", evidenceJson: JSON.stringify({}) }),
    );
    expect(screen.getByText("Bridge Search with Indexer")).toBeInTheDocument();
  });

  it("renders the forward title with destination nest", () => {
    renderRow(
      makeProposal({ kind: "forward", evidenceJson: JSON.stringify({}) }),
    );
    expect(screen.getByText("Forward signal to Search")).toBeInTheDocument();
  });

  it("renders the adopt title with destination nest", () => {
    renderRow(
      makeProposal({ kind: "adopt", evidenceJson: JSON.stringify({}) }),
    );
    expect(
      screen.getByText("Adopt wild hoglet into Search"),
    ).toBeInTheDocument();
  });

  it("calls onAccept with the proposal id when Accept is clicked", async () => {
    const user = userEvent.setup();
    const { onAccept } = renderRow(makeProposal({ id: "abc" }));
    await user.click(screen.getByRole("button", { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledWith("abc");
  });

  it("calls onDismiss with the proposal id when Dismiss is clicked", async () => {
    const user = userEvent.setup();
    const { onDismiss } = renderRow(makeProposal({ id: "abc" }));
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith("abc");
  });

  it("calls onSnooze with the proposal id when Snooze is clicked", async () => {
    const user = userEvent.setup();
    const { onSnooze } = renderRow(makeProposal({ id: "abc" }));
    await user.click(screen.getByRole("button", { name: /snooze/i }));
    expect(onSnooze).toHaveBeenCalledWith("abc");
  });
});
