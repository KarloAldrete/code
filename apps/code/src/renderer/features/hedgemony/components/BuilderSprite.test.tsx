import { Theme } from "@radix-ui/themes";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const useFederationMock = vi.hoisted(() => vi.fn());

vi.mock("@features/hedgemony/hooks/useFederation", () => ({
  useFederation: useFederationMock,
}));

vi.mock("./AnimatedHedgehog", () => ({
  AnimatedHedgehog: () => <div data-testid="mock-hedgehog" />,
}));

vi.mock("../utils/collisionResolution", () => ({
  useCollisionResolvedPosition: () => ({
    resolvedX: { get: () => 0, on: () => () => {}, set: () => {} },
    resolvedY: { get: () => 0, on: () => () => {}, set: () => {} },
  }),
}));

import { BuilderSprite } from "./BuilderSprite";

function setUnreadCount(count: number) {
  useFederationMock.mockReturnValue({
    openProposals: [],
    unreadCount: count,
    overlapsForNest: [],
    bridgesForNest: [],
    overlayVisible: false,
    acceptProposal: vi.fn(),
    dismissProposal: vi.fn(),
    snoozeProposal: vi.fn(),
    createBridge: vi.fn(),
    removeBridge: vi.fn(),
    mergeNests: vi.fn(),
    splitNest: vi.fn(),
    toggleOverlay: vi.fn(),
    markNoticesRead: vi.fn(),
  });
}

function renderSprite() {
  render(
    <Theme>
      <BuilderSprite path={[{ x: 0, y: 0 }]} animation="idle" />
    </Theme>,
  );
}

describe("BuilderSprite unread badge", () => {
  afterEach(() => {
    useFederationMock.mockReset();
  });

  it("hides the badge when the unread count is zero", () => {
    setUnreadCount(0);
    renderSprite();
    expect(
      screen.queryByTestId("builder-unread-badge"),
    ).not.toBeInTheDocument();
  });

  it("shows the exact count when below ten", () => {
    setUnreadCount(3);
    renderSprite();
    const badge = screen.getByTestId("builder-unread-badge");
    expect(badge).toHaveTextContent("3");
  });

  it("shows 9+ when the count exceeds nine", () => {
    setUnreadCount(12);
    renderSprite();
    const badge = screen.getByTestId("builder-unread-badge");
    expect(badge).toHaveTextContent("9+");
  });
});
