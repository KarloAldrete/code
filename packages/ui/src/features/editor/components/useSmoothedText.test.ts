import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSmoothedText } from "./useSmoothedText";

// Manual rAF queue so we can step frames deterministically and honor cancels.
let frames = new Map<number, FrameRequestCallback>();
let nextId = 1;

beforeEach(() => {
  frames = new Map();
  nextId = 1;
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    const id = nextId++;
    frames.set(id, cb);
    return id;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    frames.delete(id);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stepFrames(n: number) {
  for (let i = 0; i < n; i++) {
    const pending = [...frames.values()];
    frames.clear();
    act(() => {
      for (const cb of pending) cb(0);
    });
  }
}

describe("useSmoothedText", () => {
  it("shows the initial text immediately (no replay on mount)", () => {
    const { result } = renderHook(({ t }) => useSmoothedText(t), {
      initialProps: { t: "hello" },
    });
    expect(result.current).toBe("hello");
  });

  it("reveals appended text gradually, then converges to the target", () => {
    const target = "hello world this is a longer streamed message indeed";
    const { result, rerender } = renderHook(({ t }) => useSmoothedText(t), {
      initialProps: { t: "hello" },
    });
    rerender({ t: target });

    stepFrames(1);
    expect(result.current.length).toBeGreaterThanOrEqual("hello".length);
    expect(result.current.length).toBeLessThan(target.length);

    stepFrames(40);
    expect(result.current).toBe(target);
  });

  it("always shows a prefix of the target and never overshoots", () => {
    const target = "abcdefghijklmnopqrstuvwxyz";
    const { result, rerender } = renderHook(({ t }) => useSmoothedText(t), {
      initialProps: { t: "" },
    });
    rerender({ t: target });
    stepFrames(3);
    expect(target.startsWith(result.current)).toBe(true);
    expect(result.current.length).toBeLessThanOrEqual(target.length);
  });
});
