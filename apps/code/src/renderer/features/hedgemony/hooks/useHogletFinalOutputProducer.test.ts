import type { AgentSession } from "@features/sessions/stores/sessionStore";
import type { Hoglet } from "@main/services/hedgemony/schemas";
import type { AcpMessage } from "@shared/types/session-events";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRecordHogletFinalOutput = vi.hoisted(() => vi.fn());
const mockUseFeatureFlag = vi.hoisted(() => vi.fn(() => true));
const mockWarn = vi.hoisted(() => vi.fn());

vi.mock("@renderer/trpc/client", () => ({
  trpcClient: {
    hedgemony: {
      nestChat: {
        recordHogletFinalOutput: {
          mutate: mockRecordHogletFinalOutput,
        },
      },
    },
  },
}));

vi.mock("@hooks/useFeatureFlag", () => ({
  useFeatureFlag: mockUseFeatureFlag,
}));

vi.mock("@utils/logger", () => ({
  logger: {
    scope: () => ({
      warn: mockWarn,
    }),
  },
}));

import {
  sessionStoreSetters,
  useSessionStore,
} from "@features/sessions/stores/sessionStore";
import { useHogletStore } from "../stores/hogletStore";
import { useHogletFinalOutputProducer } from "./useHogletFinalOutputProducer";

function makeHoglet(overrides: Partial<Hoglet> = {}): Hoglet {
  const now = "2026-05-18T00:00:00.000Z";
  return {
    id: "hoglet-1",
    name: "Jovan",
    taskId: "task-1",
    nestId: "nest-1",
    signalReportId: null,
    affinityScore: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

function makeSession(overrides: Partial<AgentSession> = {}): AgentSession {
  return {
    taskRunId: "run-1",
    taskId: "task-1",
    taskTitle: "Verify checkout",
    channel: "agent-event:run-1",
    events: [],
    startedAt: Date.now(),
    status: "connected",
    isPromptPending: false,
    isCompacting: false,
    promptStartedAt: null,
    pendingPermissions: new Map(),
    pausedDurationMs: 0,
    messageQueue: [],
    optimisticItems: [],
    isCloud: true,
    ...overrides,
  };
}

function agentMessage(text: string, ts = 1): AcpMessage {
  return {
    type: "acp_message",
    ts,
    message: {
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        update: {
          sessionUpdate: "agent_message",
          content: { type: "text", text },
        },
      },
    },
  };
}

function turnComplete(stopReason = "end_turn", ts = 2): AcpMessage {
  return {
    type: "acp_message",
    ts,
    message: {
      jsonrpc: "2.0",
      method: "_posthog/turn_complete",
      params: { sessionId: "session-1", stopReason },
    },
  };
}

function seedHoglet(overrides: Partial<Hoglet> = {}): Hoglet {
  const hoglet = makeHoglet(overrides);
  useHogletStore.getState().setBucket(hoglet.nestId ?? "wild", [hoglet]);
  return hoglet;
}

function seedSession(overrides: Partial<AgentSession> = {}): AgentSession {
  const session = makeSession(overrides);
  sessionStoreSetters.setSession(session);
  return session;
}

function appendEvents(taskRunId: string, events: AcpMessage[]) {
  act(() => {
    sessionStoreSetters.appendEvents(taskRunId, events);
  });
}

describe("useHogletFinalOutputProducer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseFeatureFlag.mockReturnValue(true);
    mockRecordHogletFinalOutput.mockResolvedValue({});
    useSessionStore.setState({ sessions: {}, taskIdIndex: {} });
    useHogletStore.getState().reset();
  });

  it("records final output when a hoglet cloud session receives deliverable text", async () => {
    seedHoglet();
    seedSession();
    renderHook(() => useHogletFinalOutputProducer());

    appendEvents("run-1", [
      agentMessage("Verification complete. All checks pass."),
      turnComplete(),
    ]);

    await waitFor(() => {
      expect(mockRecordHogletFinalOutput).toHaveBeenCalledWith({
        nestId: "nest-1",
        hogletId: "hoglet-1",
        taskId: "task-1",
        runId: "run-1",
        body: "Verification complete. All checks pass.",
      });
    });
  });

  it("does not subscribe or record when hedgemony is disabled", () => {
    mockUseFeatureFlag.mockReturnValue(false);
    seedHoglet();
    seedSession();
    renderHook(() => useHogletFinalOutputProducer());

    appendEvents("run-1", [
      agentMessage("Verification complete. All checks pass."),
      turnComplete(),
    ]);

    expect(mockRecordHogletFinalOutput).not.toHaveBeenCalled();
  });

  it("does not record non-deliverable text or burn the run dedupe slot", async () => {
    seedHoglet();
    seedSession();
    renderHook(() => useHogletFinalOutputProducer());

    appendEvents("run-1", [
      agentMessage("Reading files and checking the test layout."),
      turnComplete("end_turn", 2),
    ]);

    expect(mockRecordHogletFinalOutput).not.toHaveBeenCalled();

    appendEvents("run-1", [
      agentMessage("Verification complete. No regressions found.", 3),
      turnComplete("end_turn", 4),
    ]);

    await waitFor(() => {
      expect(mockRecordHogletFinalOutput).toHaveBeenCalledTimes(1);
    });
  });

  it("does not record twice for the same hoglet and run", async () => {
    seedHoglet();
    seedSession();
    renderHook(() => useHogletFinalOutputProducer());

    appendEvents("run-1", [
      agentMessage("Verification complete. All checks pass.", 1),
      turnComplete("end_turn", 2),
    ]);
    appendEvents("run-1", [
      agentMessage("Verification complete. Still clean.", 3),
      turnComplete("end_turn", 4),
    ]);

    await waitFor(() => {
      expect(mockRecordHogletFinalOutput).toHaveBeenCalledTimes(1);
    });
  });

  it("does not record for local sessions", () => {
    seedHoglet();
    seedSession({ isCloud: false });
    renderHook(() => useHogletFinalOutputProducer());

    appendEvents("run-1", [
      agentMessage("Verification complete. All checks pass."),
      turnComplete(),
    ]);

    expect(mockRecordHogletFinalOutput).not.toHaveBeenCalled();
  });

  it("does not record when the session task is not a known hoglet", () => {
    seedHoglet({ taskId: "different-task" });
    seedSession();
    renderHook(() => useHogletFinalOutputProducer());

    appendEvents("run-1", [
      agentMessage("Verification complete. All checks pass."),
      turnComplete(),
    ]);

    expect(mockRecordHogletFinalOutput).not.toHaveBeenCalled();
  });

  it("clears dedupe on mutation rejection so a later deliverable can retry", async () => {
    mockRecordHogletFinalOutput
      .mockRejectedValueOnce(new Error("write failed"))
      .mockResolvedValueOnce({});
    seedHoglet();
    seedSession();
    renderHook(() => useHogletFinalOutputProducer());

    appendEvents("run-1", [
      agentMessage("Verification complete. All checks pass.", 1),
      turnComplete("end_turn", 2),
    ]);

    await waitFor(() => {
      expect(mockWarn).toHaveBeenCalled();
    });

    appendEvents("run-1", [
      agentMessage("Verification complete. Retrying final output.", 3),
      turnComplete("end_turn", 4),
    ]);

    await waitFor(() => {
      expect(mockRecordHogletFinalOutput).toHaveBeenCalledTimes(2);
    });
  });

  it("unsubscribes on unmount", () => {
    seedHoglet();
    seedSession();
    const { unmount } = renderHook(() => useHogletFinalOutputProducer());

    unmount();
    appendEvents("run-1", [
      agentMessage("Verification complete. All checks pass."),
      turnComplete(),
    ]);

    expect(mockRecordHogletFinalOutput).not.toHaveBeenCalled();
  });
});
