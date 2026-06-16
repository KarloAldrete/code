import type { AcpMessage, AgentSession } from "@posthog/shared";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { sessionStoreSetters, useSessionStore } from "./sessionStore";
import { useSessions, useSidebarStatusForTask } from "./useSession";

function makeSession(taskId: string, taskRunId: string): AgentSession {
  return {
    taskId,
    taskRunId,
    events: [],
    isPromptPending: false,
    pendingPermissions: new Map(),
  } as unknown as AgentSession;
}

const TOKEN = {} as AcpMessage;

/** Mount a hook and count how many times it (re)renders. */
function countRenders<T>(hook: () => T): () => number {
  let n = 0;
  renderHook(() => {
    n++;
    return hook();
  });
  return () => n;
}

describe("useSidebarStatusForTask — per-row status, cheap during streaming", () => {
  beforeEach(() => {
    useSessionStore.setState({ sessions: {}, taskIdIndex: {} });
    sessionStoreSetters.setSession(makeSession("t1", "r1"));
  });

  it("baseline: useSessions() re-renders on every streamed token", () => {
    const renders = countRenders(() => useSessions());
    const before = renders();
    for (let i = 0; i < 20; i++) {
      act(() => sessionStoreSetters.appendEvents("r1", [TOKEN]));
    }
    expect(renders() - before).toBe(20);
  });

  it("a row's status ignores streamed tokens (0 re-renders)", () => {
    const renders = countRenders(() => useSidebarStatusForTask("t1"));
    const before = renders();
    for (let i = 0; i < 20; i++) {
      act(() => sessionStoreSetters.appendEvents("r1", [TOKEN]));
    }
    expect(renders() - before).toBe(0);
  });

  it("re-renders the row when a status field actually changes", () => {
    const renders = countRenders(() => useSidebarStatusForTask("t1"));
    const before = renders();
    act(() =>
      sessionStoreSetters.updateSession("r1", { isPromptPending: true }),
    );
    expect(renders() - before).toBe(1);
  });

  it("derives the row status fields from the session", () => {
    const { result } = renderHook(() => useSidebarStatusForTask("t1"));
    expect(result.current).toEqual({
      isGenerating: false,
      needsPermission: false,
      taskRunStatus: undefined,
      cloudPrUrl: null,
    });
    act(() =>
      sessionStoreSetters.updateSession("r1", { isPromptPending: true }),
    );
    expect(result.current?.isGenerating).toBe(true);
  });

  it("returns null for an unknown task", () => {
    const { result } = renderHook(() => useSidebarStatusForTask("nope"));
    expect(result.current).toBeNull();
  });
});
