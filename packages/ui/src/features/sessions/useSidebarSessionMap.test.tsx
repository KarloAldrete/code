import type { AcpMessage, AgentSession } from "@posthog/shared";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { sessionStoreSetters, useSessionStore } from "./sessionStore";
import { useSessions, useSidebarSessionMap } from "./useSession";

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

describe("sidebar session subscription — re-render cost during streaming", () => {
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
    // Old behaviour: one re-render per token (and the sidebar is at the root).
    expect(renders() - before).toBe(20);
  });

  it("fixed: useSidebarSessionMap() ignores streamed tokens (0 re-renders)", () => {
    const renders = countRenders(() => useSidebarSessionMap());
    const before = renders();
    for (let i = 0; i < 20; i++) {
      act(() => sessionStoreSetters.appendEvents("r1", [TOKEN]));
    }
    expect(renders() - before).toBe(0);
  });

  it("fixed: still re-renders when a sidebar-relevant field changes", () => {
    const renders = countRenders(() => useSidebarSessionMap());
    const before = renders();
    act(() =>
      sessionStoreSetters.updateSession("r1", { isPromptPending: true }),
    );
    expect(renders() - before).toBe(1);
  });
});
