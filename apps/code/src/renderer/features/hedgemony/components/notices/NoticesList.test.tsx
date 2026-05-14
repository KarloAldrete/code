import type { Proposal } from "@main/services/hedgemony/schemas";
import { Theme } from "@radix-ui/themes";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoticesList } from "./NoticesList";

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

describe("NoticesList", () => {
  it("renders the empty-state message when there are no proposals", () => {
    render(
      <Theme>
        <NoticesList
          proposals={[]}
          nestsById={{}}
          onAccept={vi.fn()}
          onDismiss={vi.fn()}
          onSnooze={vi.fn()}
        />
      </Theme>,
    );
    expect(screen.getByText("Nothing to review")).toBeInTheDocument();
  });

  it("renders a row per proposal", () => {
    render(
      <Theme>
        <NoticesList
          proposals={[
            makeProposal({ id: "p1", kind: "merge" }),
            makeProposal({ id: "p2", kind: "bridge" }),
          ]}
          nestsById={{}}
          onAccept={vi.fn()}
          onDismiss={vi.fn()}
          onSnooze={vi.fn()}
        />
      </Theme>,
    );
    expect(screen.getAllByRole("button", { name: /accept/i })).toHaveLength(2);
  });
});
