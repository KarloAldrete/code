import type { AcpMessage } from "@shared/types/session-events";
import { describe, expect, it } from "vitest";
import {
  extractTerminalAssistantOutput,
  hasTurnComplete,
  looksLikeHogletFinalOutput,
} from "./hogletFinalOutput";

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

function agentChunk(text: string, ts = 1): AcpMessage {
  return {
    type: "acp_message",
    ts,
    message: {
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        update: {
          sessionUpdate: "agent_message_chunk",
          content: { type: "text", text },
        },
      },
    },
  };
}

function toolCall(ts = 1): AcpMessage {
  return {
    type: "acp_message",
    ts,
    message: {
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        update: {
          sessionUpdate: "tool_call",
          toolCallId: "tool-1",
          title: "Read",
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

describe("hoglet final output extraction", () => {
  it("extracts assistant text from a terminal turn", () => {
    expect(
      extractTerminalAssistantOutput([
        agentMessage("Verification complete.", 10),
        turnComplete("end_turn", 20),
      ]),
    ).toBe("Verification complete.");
  });

  it("joins streamed assistant chunks from the completed turn", () => {
    expect(
      extractTerminalAssistantOutput([
        agentChunk("Verification ", 10),
        agentChunk("complete.", 11),
        turnComplete("end_turn", 20),
      ]),
    ).toBe("Verification complete.");
  });

  it("ignores non-terminal tool-use turns", () => {
    expect(
      extractTerminalAssistantOutput([
        agentMessage("I will inspect this."),
        toolCall(11),
        turnComplete("tool_use", 20),
      ]),
    ).toBeNull();
  });

  it("only reads the latest completed turn", () => {
    expect(
      extractTerminalAssistantOutput([
        agentMessage("Earlier summary.", 10),
        turnComplete("end_turn", 20),
        agentMessage("Final verification.", 30),
        turnComplete("end_turn", 40),
      ]),
    ).toBe("Final verification.");
  });

  it("classifies deliverable-shaped assistant output", () => {
    expect(
      looksLikeHogletFinalOutput("Verification complete. All checks pass."),
    ).toBe(true);
    expect(
      looksLikeHogletFinalOutput("Still investigating the flaky test."),
    ).toBe(false);
  });

  it("detects turn-complete notifications", () => {
    expect(hasTurnComplete([agentMessage("working")])).toBe(false);
    expect(hasTurnComplete([turnComplete()])).toBe(true);
  });
});
