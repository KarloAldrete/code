import type { AcpMessage } from "@posthog/shared";
import { createStore } from "zustand/vanilla";

/**
 * Domain state for a deployed-agent live chat. One active chat at a time (the
 * preview/test surface, or the concierge dock). The UI hook owns the transport
 * (run/send/cancel + the SSE loop, via the api-client) and pumps mapped
 * `AcpMessage`s in here; components read the store and render through
 * `ConversationView`. Multi-chat (concierge + preview side by side) would key
 * this by a chat id — single active chat is enough for now.
 */

export type AgentChatStatus =
  | "idle"
  | "starting"
  | "streaming"
  | "awaiting_input"
  | "completed"
  | "failed"
  | "cancelled";

interface AgentChatState {
  /** Which agent this chat targets (slug), or null when idle. */
  agentKey: string | null;
  sessionId: string | null;
  status: AgentChatStatus;
  /** Accumulated ACP messages (mapper output) for ConversationView. */
  messages: AcpMessage[];
  error: string | null;

  /** Reset for a brand-new chat against `agentKey`. */
  begin: (agentKey: string) => void;
  setSessionId: (sessionId: string) => void;
  setStatus: (status: AgentChatStatus) => void;
  appendMessages: (messages: AcpMessage[]) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const EMPTY: Pick<
  AgentChatState,
  "agentKey" | "sessionId" | "status" | "messages" | "error"
> = {
  agentKey: null,
  sessionId: null,
  status: "idle",
  messages: [],
  error: null,
};

export const agentChatStore = createStore<AgentChatState>((set) => ({
  ...EMPTY,
  begin: (agentKey) =>
    set({
      agentKey,
      sessionId: null,
      status: "starting",
      messages: [],
      error: null,
    }),
  setSessionId: (sessionId) => set({ sessionId }),
  setStatus: (status) => set({ status }),
  appendMessages: (messages) =>
    set((s) =>
      messages.length === 0 ? s : { messages: [...s.messages, ...messages] },
    ),
  setError: (error) => set({ error }),
  reset: () => set({ ...EMPTY }),
}));
