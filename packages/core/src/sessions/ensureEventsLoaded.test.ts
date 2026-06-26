import type { AgentSession } from "@posthog/shared";
import { describe, expect, it, vi } from "vitest";
import { createBaseSession } from "./sessionFactory";
import { SessionService, type SessionServiceDeps } from "./sessionService";

const TASK_ID = "task-1";
const RUN_ID = "run-1";

function ndjson(...texts: string[]): string {
  return texts
    .map((text) =>
      JSON.stringify({
        type: "notification",
        timestamp: "2026-06-16T15:22:35.396Z",
        notification: {
          jsonrpc: "2.0",
          method: "session/update",
          params: { update: { sessionUpdate: "agent_message_chunk", text } },
        },
      }),
    )
    .join("\n");
}

function createHarness(
  sessionOverrides: Partial<AgentSession> = {},
  localLogs = ndjson("hello", "world"),
) {
  const sessions: Record<string, AgentSession> = {};
  const base = createBaseSession(RUN_ID, TASK_ID, "Task");
  sessions[RUN_ID] = { ...base, events: [], ...sessionOverrides };

  const updateSession = vi.fn(
    (taskRunId: string, updates: Partial<AgentSession>) => {
      const session = sessions[taskRunId];
      if (session) Object.assign(session, updates);
    },
  );

  const readLocalLogs = vi.fn().mockResolvedValue(localLogs);

  const store = {
    getSessions: () => sessions,
    getSessionByTaskId: (taskId: string) =>
      Object.values(sessions).find((s) => s.taskId === taskId),
    setSession: (s: AgentSession) => {
      sessions[s.taskRunId] = s;
    },
    updateSession,
  };

  const deps = {
    store,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    trpc: {
      agent: {
        onSessionIdleKilled: {
          subscribe: () => ({ unsubscribe: vi.fn() }),
        },
      },
      logs: {
        readLocalLogs: { query: readLocalLogs },
        fetchS3Logs: { query: vi.fn().mockResolvedValue("") },
        writeLocalLogs: { mutate: vi.fn().mockResolvedValue(undefined) },
      },
    },
  } as unknown as SessionServiceDeps;

  return {
    service: new SessionService(deps),
    sessions,
    updateSession,
    readLocalLogs,
  };
}

describe("SessionService.ensureEventsLoaded", () => {
  it("rehydrates events from disk for an evicted (empty) session", async () => {
    const h = createHarness();

    await h.service.ensureEventsLoaded(TASK_ID);

    expect(h.readLocalLogs).toHaveBeenCalledWith({ taskRunId: RUN_ID });
    expect(h.sessions[RUN_ID].events.length).toBeGreaterThan(0);
  });

  it("no-ops when events are already resident (no disk read)", async () => {
    const h = createHarness({
      events: [{ message: {} }] as unknown as AgentSession["events"],
    });

    await h.service.ensureEventsLoaded(TASK_ID);

    expect(h.readLocalLogs).not.toHaveBeenCalled();
    expect(h.updateSession).not.toHaveBeenCalled();
  });

  it("no-ops for an unknown task", async () => {
    const h = createHarness();
    await h.service.ensureEventsLoaded("nope");
    expect(h.readLocalLogs).not.toHaveBeenCalled();
  });

  it("sets processedLineCount for cloud sessions, leaves it undefined for local", async () => {
    const cloud = createHarness({ isCloud: true });
    await cloud.service.ensureEventsLoaded(TASK_ID);
    expect(cloud.sessions[RUN_ID].processedLineCount).toBe(2);

    const local = createHarness({ isCloud: false });
    await local.service.ensureEventsLoaded(TASK_ID);
    expect(local.sessions[RUN_ID].processedLineCount).toBeUndefined();
  });

  it("does not clobber events when a turn starts streaming during the load", async () => {
    const h = createHarness();
    // Simulate a turn starting (isPromptPending) + a streamed event landing
    // while the disk read is in flight — the live transcript is authoritative.
    h.readLocalLogs.mockImplementationOnce(async () => {
      h.sessions[RUN_ID].isPromptPending = true;
      h.sessions[RUN_ID].events = [
        { message: {} },
      ] as unknown as AgentSession["events"];
      return ndjson("stale");
    });

    await h.service.ensureEventsLoaded(TASK_ID);

    // The streamed event survives; the historical load is discarded.
    expect(h.sessions[RUN_ID].events).toHaveLength(1);
    expect(h.updateSession).not.toHaveBeenCalled();
  });

  it("renders the tail first, then swaps in the full transcript", async () => {
    // A log larger than the 256KB tail window → phase 1 seeds a tail placeholder,
    // phase 2 replaces it with the complete set.
    const bigLog = ndjson(...Array.from({ length: 4000 }, (_, i) => `m${i}`));
    const h = createHarness({}, bigLog);

    await h.service.ensureEventsLoaded(TASK_ID);

    // Final state is the full transcript (4000 events).
    expect(h.sessions[RUN_ID].events.length).toBe(4000);
    // updateSession was called at least twice: tail seed + full swap.
    expect(h.updateSession.mock.calls.length).toBeGreaterThanOrEqual(2);
    const firstLen = (h.updateSession.mock.calls[0][1].events as unknown[])
      .length;
    expect(firstLen).toBeGreaterThan(0);
    expect(firstLen).toBeLessThan(4000); // the tail, not everything
  });
});
