import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRendererWindowFocusStore } from "./rendererWindowFocusStore";

// The store reads document.hasFocus() and document.visibilityState through
// its computeWindowFocused() helper. We drive transitions by stubbing both
// before dispatching the focus/blur events the listeners are bound to.

function setDocumentFocused(focused: boolean): void {
  vi.spyOn(document, "hasFocus").mockReturnValue(focused);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (focused ? "visible" : "hidden"),
  });
}

describe("rendererWindowFocusStore", () => {
  beforeEach(() => {
    setDocumentFocused(true);
    useRendererWindowFocusStore.setState({ focused: true, focusedAt: 1_000 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears focusedAt when the window loses focus", () => {
    setDocumentFocused(false);
    window.dispatchEvent(new Event("blur"));

    const state = useRendererWindowFocusStore.getState();
    expect(state.focused).toBe(false);
    expect(state.focusedAt).toBeNull();
  });

  it("records a fresh focusedAt when focus returns", () => {
    useRendererWindowFocusStore.setState({ focused: false, focusedAt: null });
    setDocumentFocused(true);
    vi.spyOn(Date, "now").mockReturnValue(2_500);

    window.dispatchEvent(new Event("focus"));

    const state = useRendererWindowFocusStore.getState();
    expect(state.focused).toBe(true);
    expect(state.focusedAt).toBe(2_500);
  });

  it("does not reset focusedAt when a focus event fires while already focused", () => {
    // While focused, OS / Electron can fire a redundant `focus` event (e.g.
    // when a child frame regains focus). The backoff ramp must not restart.
    setDocumentFocused(true);
    window.dispatchEvent(new Event("focus"));

    expect(useRendererWindowFocusStore.getState().focusedAt).toBe(1_000);
  });
});
