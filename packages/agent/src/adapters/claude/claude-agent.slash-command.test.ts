import type { AgentSideConnection } from "@agentclientprotocol/sdk";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockQuery, type MockQuery } from "../../test/mocks/claude-sdk";
import { Pushable } from "../../utils/streams";

vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

vi.mock("./mcp/tool-metadata", () => ({
  fetchMcpToolMetadata: vi.fn().mockResolvedValue(undefined),
  getConnectedMcpServerNames: vi.fn().mockReturnValue([]),
  setMcpToolApprovalStates: vi.fn(),
  isMcpToolReadOnly: vi.fn().mockReturnValue(false),
  getMcpToolMetadata: vi.fn().mockReturnValue(undefined),
  getMcpToolApprovalState: vi.fn().mockReturnValue(undefined),
}));

const { ClaudeAcpAgent } = await import("./claude-agent");
type Agent = InstanceType<typeof ClaudeAcpAgent>;

interface ClientMocks {
  sessionUpdate: ReturnType<typeof vi.fn>;
  extNotification: ReturnType<typeof vi.fn>;
}

function makeAgent(): { agent: Agent; client: ClientMocks } {
  const client: ClientMocks = {
    sessionUpdate: vi.fn().mockResolvedValue(undefined),
    extNotification: vi.fn().mockResolvedValue(undefined),
  };
  const agent = new ClaudeAcpAgent(client as unknown as AgentSideConnection);
  return { agent, client };
}

function installFakeSession(agent: Agent, sessionId: string): MockQuery {
  const query = createMockQuery();
  const input = new Pushable();
  const abortController = new AbortController();

  const session = {
    query,
    queryOptions: { sessionId, cwd: "/tmp/repo", abortController },
    input,
    cancelled: false,
    interruptReason: undefined,
    settingsManager: { dispose: vi.fn(), getRepoRoot: () => "/tmp/repo" },
    permissionMode: "default" as const,
    abortController,
    accumulatedUsage: {
      inputTokens: 0,
      outputTokens: 0,
      cachedReadTokens: 0,
      cachedWriteTokens: 0,
    },
    configOptions: [],
    promptRunning: false,
    pendingMessages: new Map(),
    nextPendingOrder: 0,
    cwd: "/tmp/repo",
    notificationHistory: [] as unknown[],
    taskRunId: "run-1",
    lastContextWindowSize: 200_000,
    modelId: "claude-sonnet-4-6",
  };

  (agent as unknown as { session: typeof session }).session = session;
  (agent as unknown as { sessionId: string }).sessionId = sessionId;

  return query;
}

describe("ClaudeAcpAgent.prompt — unsupported slash command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits a clear error and ends the turn when SDK silently consumes an unsupported slash command", async () => {
    const { agent, client } = makeAgent();
    const query = installFakeSession(agent, "s-slash");

    const promptPromise = agent.prompt({
      sessionId: "s-slash",
      prompt: [{ type: "text", text: "/plugin install slack" }],
    });

    // Let the prompt loop start awaiting the first SDK message.
    await new Promise((resolve) => setImmediate(resolve));

    // Simulate the SDK going idle without echoing the user message back
    // (the failure mode reported in #2158).
    const idleMessage: SDKMessage = {
      type: "system",
      subtype: "session_state_changed",
      state: "idle",
    } as unknown as SDKMessage;
    query._mockHelpers.sendMessage(idleMessage);
    query._mockHelpers.complete();

    const result = await promptPromise;

    expect(result.stopReason).toBe("end_turn");

    const errorChunk = client.sessionUpdate.mock.calls.find(
      ([call]) =>
        (call as { update?: { sessionUpdate?: string } }).update
          ?.sessionUpdate === "agent_message_chunk",
    );
    expect(errorChunk).toBeDefined();
    const errorText =
      (
        errorChunk?.[0] as {
          update: { content: { text: string } };
        }
      ).update.content.text ?? "";
    expect(errorText).toContain("/plugin");
    expect(errorText.toLowerCase()).toContain("unsupported");
  });

  it("still skips a pre-prompt idle for non-slash-command prompts", async () => {
    const { agent, client } = makeAgent();
    const query = installFakeSession(agent, "s-regular");

    const promptPromise = agent.prompt({
      sessionId: "s-regular",
      prompt: [{ type: "text", text: "hello" }],
    });

    await new Promise((resolve) => setImmediate(resolve));

    // First an unrelated idle (e.g. from a background task) before the prompt
    // is replayed — should be skipped, not surfaced as an error.
    query._mockHelpers.sendMessage({
      type: "system",
      subtype: "session_state_changed",
      state: "idle",
    } as unknown as SDKMessage);

    // Then the SDK is done with no further output. The existing loop exits via
    // the "Session did not end in result" path.
    query._mockHelpers.complete();

    await expect(promptPromise).rejects.toThrow(
      /Session did not end in result/,
    );

    // Most importantly: no agent_message_chunk with an "unsupported" error
    // was emitted for the regular prompt.
    const errorChunk = client.sessionUpdate.mock.calls.find(([call]) => {
      const update = (
        call as {
          update?: { sessionUpdate?: string; content?: { text?: string } };
        }
      ).update;
      return (
        update?.sessionUpdate === "agent_message_chunk" &&
        update?.content?.text?.toLowerCase().includes("unsupported")
      );
    });
    expect(errorChunk).toBeUndefined();
  });
});
