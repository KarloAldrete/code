import type { TaskData } from "@posthog/core/sidebar/sidebarData.types";
import type { AgentSession } from "@posthog/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { sessionStoreSetters, useSessionStore } from "../sessions/sessionStore";
import { isTaskActivelyRunning } from "./isTaskActivelyRunning";

function makeSession(taskId: string, taskRunId: string): AgentSession {
  return {
    taskId,
    taskRunId,
    events: [],
    isPromptPending: false,
    pendingPermissions: new Map(),
  } as unknown as AgentSession;
}

function makeTask(overrides: Partial<TaskData> = {}): TaskData {
  return {
    id: "t1",
    title: "Task",
    createdAt: 0,
    lastActivityAt: 0,
    isGenerating: false,
    isUnread: false,
    isPinned: false,
    needsPermission: false,
    repository: null,
    isSuspended: false,
    folderPath: null,
    cloudPrUrl: null,
    branchName: null,
    linkedBranch: null,
    ...overrides,
  };
}

describe("isTaskActivelyRunning (archive guard — live lookup)", () => {
  beforeEach(() => {
    useSessionStore.setState({ sessions: {}, taskIdIndex: {} });
  });

  it("is false for an idle task with no session", () => {
    expect(isTaskActivelyRunning(makeTask())).toBe(false);
  });

  it("is true when the live session is generating (isPromptPending)", () => {
    sessionStoreSetters.setSession(makeSession("t1", "r1"));
    sessionStoreSetters.updateSession("r1", { isPromptPending: true });
    expect(isTaskActivelyRunning(makeTask())).toBe(true);
  });

  it("is true when the live cloud status is in_progress", () => {
    sessionStoreSetters.setSession(makeSession("t1", "r1"));
    sessionStoreSetters.updateSession("r1", { cloudStatus: "in_progress" });
    expect(isTaskActivelyRunning(makeTask())).toBe(true);
  });

  it("falls back to the task's API run status when there is no session", () => {
    expect(
      isTaskActivelyRunning(makeTask({ taskRunStatus: "in_progress" })),
    ).toBe(true);
  });

  it("is false when a session exists but is idle", () => {
    sessionStoreSetters.setSession(makeSession("t1", "r1"));
    expect(isTaskActivelyRunning(makeTask())).toBe(false);
  });
});
