import { Theme } from "@radix-ui/themes";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudInitializingView } from "./CloudInitializingView";

// The view hides everything behind a 2s reveal delay; fast-forward past it so
// the heading and controls are mounted.
function reveal() {
  act(() => {
    vi.advanceTimersByTime(2000);
  });
}

describe("CloudInitializingView", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a cancel control while provisioning when onCancel is provided", () => {
    render(
      <Theme>
        <CloudInitializingView cloudStatus={null} onCancel={() => {}} />
      </Theme>,
    );
    reveal();
    expect(screen.getByText("Getting things ready…")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Cancel" }),
    ).toBeInTheDocument();
  });

  it("omits the cancel control when no handler is provided", () => {
    render(
      <Theme>
        <CloudInitializingView cloudStatus="queued" />
      </Theme>,
    );
    reveal();
    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
  });

  it("invokes onCancel once and shows a pending label on click", () => {
    const onCancel = vi.fn();
    render(
      <Theme>
        <CloudInitializingView cloudStatus="queued" onCancel={onCancel} />
      </Theme>,
    );
    reveal();

    const button = screen.getByRole("button", { name: "Cancel" });
    act(() => {
      button.click();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    const pending = screen.getByRole("button", { name: "Cancelling…" });
    expect(pending).toBeDisabled();

    // A second click is a no-op while the cancel is in flight.
    act(() => {
      pending.click();
    });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
