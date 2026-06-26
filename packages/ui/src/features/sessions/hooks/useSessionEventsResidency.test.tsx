import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ensureEventsLoaded = vi.hoisted(() => vi.fn());
const getSessionByTaskId = vi.hoisted(() => vi.fn());
const evictEvents = vi.hoisted(() => vi.fn());

vi.mock("@posthog/di/react", () => ({
  useService: () => ({ ensureEventsLoaded }),
}));
vi.mock("@posthog/ui/features/sessions/sessionStore", () => ({
  sessionStoreSetters: { getSessionByTaskId, evictEvents },
}));

import { useSessionEventsResidency } from "./useSessionEventsResidency";

const GRACE_MS = 20_000;

function idleSession(overrides: Record<string, unknown> = {}) {
  return {
    taskRunId: "run-1",
    events: [{ message: {} }],
    isPromptPending: false,
    isCompacting: false,
    isCloud: false,
    cloudStatus: undefined,
    messageQueue: [],
    ...overrides,
  };
}

describe("useSessionEventsResidency", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    ensureEventsLoaded.mockReset();
    getSessionByTaskId.mockReset().mockReturnValue(idleSession());
    evictEvents.mockReset();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rehydrates events on mount", () => {
    renderHook(() => useSessionEventsResidency("task-1"));
    expect(ensureEventsLoaded).toHaveBeenCalledWith("task-1");
  });

  it("evicts an idle session after the grace window on unmount", () => {
    const { unmount } = renderHook(() => useSessionEventsResidency("task-1"));
    unmount();
    expect(evictEvents).not.toHaveBeenCalled(); // still within grace
    vi.advanceTimersByTime(GRACE_MS);
    expect(evictEvents).toHaveBeenCalledWith("run-1");
  });

  it("never evicts a streaming session", () => {
    getSessionByTaskId.mockReturnValue(idleSession({ isPromptPending: true }));
    const { unmount } = renderHook(() => useSessionEventsResidency("task-1"));
    unmount();
    vi.advanceTimersByTime(GRACE_MS);
    expect(evictEvents).not.toHaveBeenCalled();
  });

  it("never evicts a live (non-terminal) cloud run", () => {
    getSessionByTaskId.mockReturnValue(
      idleSession({ isCloud: true, cloudStatus: "in_progress" }),
    );
    const { unmount } = renderHook(() => useSessionEventsResidency("task-1"));
    unmount();
    vi.advanceTimersByTime(GRACE_MS);
    expect(evictEvents).not.toHaveBeenCalled();
  });

  it("never evicts a session with queued messages pending dispatch", () => {
    getSessionByTaskId.mockReturnValue(
      idleSession({ messageQueue: [{ id: "q1" }] }),
    );
    const { unmount } = renderHook(() => useSessionEventsResidency("task-1"));
    unmount();
    vi.advanceTimersByTime(GRACE_MS);
    expect(evictEvents).not.toHaveBeenCalled();
  });

  it("evicts a finished (terminal) cloud run", () => {
    getSessionByTaskId.mockReturnValue(
      idleSession({ isCloud: true, cloudStatus: "completed" }),
    );
    const { unmount } = renderHook(() => useSessionEventsResidency("task-1"));
    unmount();
    vi.advanceTimersByTime(GRACE_MS);
    expect(evictEvents).toHaveBeenCalledWith("run-1");
  });

  it("cancels a pending eviction when the task is refocused within the grace window", () => {
    const { unmount } = renderHook(() => useSessionEventsResidency("task-1"));
    unmount();
    vi.advanceTimersByTime(GRACE_MS / 2);
    // Refocus before the grace window elapses.
    renderHook(() => useSessionEventsResidency("task-1"));
    vi.advanceTimersByTime(GRACE_MS);
    expect(evictEvents).not.toHaveBeenCalled();
  });
});
