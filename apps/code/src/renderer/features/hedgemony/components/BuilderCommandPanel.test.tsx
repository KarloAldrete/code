import type { Proposal } from "@main/services/hedgemony/schemas";
import { Theme } from "@radix-ui/themes";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useFederationMock = vi.hoisted(() => vi.fn());

vi.mock("@features/hedgemony/hooks/useFederation", () => ({
  useFederation: useFederationMock,
}));

vi.mock("@features/fun-mode/hooks/useFunSpeak", () => ({
  useFunSpeak: () => (s: string) => s,
}));

import { useNestStore } from "@features/hedgemony/stores/nestStore";
import { BuilderCommandPanel } from "./BuilderCommandPanel";

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

interface FederationOverrides {
  openProposals?: Proposal[];
  unreadCount?: number;
  markNoticesRead?: ReturnType<typeof vi.fn>;
  acceptProposal?: ReturnType<typeof vi.fn>;
  dismissProposal?: ReturnType<typeof vi.fn>;
  snoozeProposal?: ReturnType<typeof vi.fn>;
}

function primeFederation(overrides: FederationOverrides = {}) {
  const markNoticesRead = overrides.markNoticesRead ?? vi.fn();
  const acceptProposal =
    overrides.acceptProposal ?? vi.fn().mockResolvedValue(undefined);
  const dismissProposal =
    overrides.dismissProposal ?? vi.fn().mockResolvedValue(undefined);
  const snoozeProposal =
    overrides.snoozeProposal ?? vi.fn().mockResolvedValue(undefined);
  useFederationMock.mockReturnValue({
    openProposals: overrides.openProposals ?? [],
    unreadCount: overrides.unreadCount ?? 0,
    overlapsForNest: [],
    bridgesForNest: [],
    overlayVisible: false,
    acceptProposal,
    dismissProposal,
    snoozeProposal,
    createBridge: vi.fn(),
    removeBridge: vi.fn(),
    mergeNests: vi.fn(),
    splitNest: vi.fn(),
    toggleOverlay: vi.fn(),
    markNoticesRead,
  });
  return { markNoticesRead, acceptProposal, dismissProposal, snoozeProposal };
}

function renderPanel() {
  return render(
    <Theme>
      <BuilderCommandPanel
        onBuildNest={vi.fn()}
        onQuickNest={vi.fn()}
        onClose={vi.fn()}
      />
    </Theme>,
  );
}

beforeEach(() => {
  useNestStore.setState({ nests: {}, hedgehogStateByNestId: {}, loaded: true });
});

afterEach(() => {
  useFederationMock.mockReset();
});

describe("BuilderCommandPanel notices tab", () => {
  it("hides the tab badge when unread count is zero", () => {
    primeFederation({ unreadCount: 0 });
    renderPanel();
    expect(screen.queryByTestId("notices-tab-badge")).not.toBeInTheDocument();
  });

  it("shows the unread count on the tab badge", () => {
    primeFederation({ unreadCount: 4 });
    renderPanel();
    expect(screen.getByTestId("notices-tab-badge")).toHaveTextContent("4");
  });

  it("caps the tab badge at 9+ for counts above nine", () => {
    primeFederation({ unreadCount: 23 });
    renderPanel();
    expect(screen.getByTestId("notices-tab-badge")).toHaveTextContent("9+");
  });

  it("shows the empty state inside the notices body when there are no proposals", async () => {
    const user = userEvent.setup();
    primeFederation({ openProposals: [], unreadCount: 0 });
    renderPanel();
    await user.click(screen.getByRole("button", { name: /notices/i }));
    expect(screen.getByText("Nothing to review")).toBeInTheDocument();
  });

  it("marks notices read once the tab is opened with unread items", async () => {
    const user = userEvent.setup();
    const { markNoticesRead } = primeFederation({
      openProposals: [makeProposal()],
      unreadCount: 2,
    });
    renderPanel();
    expect(markNoticesRead).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /notices/i }));
    expect(markNoticesRead).toHaveBeenCalledTimes(1);
  });

  it("does not call markNoticesRead when the tab opens with zero unread", async () => {
    const user = userEvent.setup();
    const { markNoticesRead } = primeFederation({
      openProposals: [makeProposal()],
      unreadCount: 0,
    });
    renderPanel();
    await user.click(screen.getByRole("button", { name: /notices/i }));
    expect(markNoticesRead).not.toHaveBeenCalled();
  });
});
