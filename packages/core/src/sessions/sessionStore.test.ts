import type { AcpMessage, AgentSession } from "@posthog/shared";
import { beforeEach, describe, expect, it } from "vitest";
import { createBaseSession } from "./sessionFactory";
import { sessionStore, sessionStoreSetters } from "./sessionStore";

function event(text: string): AcpMessage {
  return {
    message: {
      jsonrpc: "2.0",
      method: "session/update",
      params: { update: { sessionUpdate: "agent_message_chunk", text } },
    },
  } as unknown as AcpMessage;
}

function seed(taskRunId: string, taskId: string): AgentSession {
  const session = createBaseSession(taskRunId, taskId, "Task");
  sessionStoreSetters.setSession(session);
  return session;
}

describe("sessionStoreSetters.evictEvents", () => {
  beforeEach(() => {
    sessionStoreSetters.clearAll();
  });

  it("empties the events array and resets processedLineCount", () => {
    seed("run-1", "task-1");
    sessionStoreSetters.appendEvents("run-1", [event("a"), event("b")], 2);
    expect(sessionStore.getState().sessions["run-1"].events).toHaveLength(2);
    expect(sessionStore.getState().sessions["run-1"].processedLineCount).toBe(
      2,
    );

    sessionStoreSetters.evictEvents("run-1");

    const session = sessionStore.getState().sessions["run-1"];
    expect(session.events).toHaveLength(0);
    expect(session.processedLineCount).toBeUndefined();
  });

  it("keeps the session and its identity index intact (non-destructive)", () => {
    seed("run-1", "task-1");
    sessionStoreSetters.appendEvents("run-1", [event("a")]);

    sessionStoreSetters.evictEvents("run-1");

    expect(sessionStore.getState().sessions["run-1"]).toBeDefined();
    expect(sessionStoreSetters.getSessionByTaskId("task-1")?.taskRunId).toBe(
      "run-1",
    );
  });

  it("is a no-op for an unknown taskRunId", () => {
    expect(() => sessionStoreSetters.evictEvents("missing")).not.toThrow();
  });

  it("lets events be appended again after eviction (rehydration path)", () => {
    seed("run-1", "task-1");
    sessionStoreSetters.appendEvents("run-1", [event("a"), event("b")]);
    sessionStoreSetters.evictEvents("run-1");

    sessionStoreSetters.appendEvents("run-1", [event("c")]);

    expect(sessionStore.getState().sessions["run-1"].events).toHaveLength(1);
  });
});
