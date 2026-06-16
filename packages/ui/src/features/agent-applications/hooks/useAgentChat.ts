import { agentChatStore } from "@posthog/core/agent-chat/agentChatStore";
import type { AgentSessionEvent } from "@posthog/shared/agent-platform-types";
import { useAuthenticatedClient } from "@posthog/ui/features/auth/authClient";
import { toast } from "@posthog/ui/primitives/toast";
import { useCallback, useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useChatHistoryStore } from "../chat/chatHistoryStore";
import { conversationToAcpMessages } from "../chat/conversationToAcp";
import {
  type AgentChatMapper,
  createAgentChatMapper,
} from "../chat/sessionEventToAcp";

/** Session states with no further activity to tail — render stored history only. */
const TERMINAL_SESSION_STATES = new Set([
  "completed",
  "closed",
  "cancelled",
  "failed",
]);

/**
 * Drives a live chat against a deployed agent's ingress: starts/sends/cancels
 * via the api-client, streams SSE through the M3 `createAgentChatMapper`, and
 * pumps the resulting ACP messages into the core `agentChatStore` (which the
 * chat pane renders through `ConversationView`).
 *
 * Transport lives here (the api-client is renderer/hook-scoped); state lives in
 * core. Client tools are dispatched here — `toast`/`get_context` are handled;
 * `focus_*`/`set_secret` degrade to `unhandled_client_tool` until the concierge
 * milestone wires UI-driving + the inline secret form.
 */
export function useAgentChat(idOrSlug: string, ingressBaseUrl: string | null) {
  const client = useAuthenticatedClient();
  const state = useStore(agentChatStore);
  const recordChat = useChatHistoryStore((s) => s.record);
  const mapperRef = useRef<AgentChatMapper>(createAgentChatMapper());
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);
  // Each stream attach bumps this; an aborted/superseded loop checks it before
  // touching the store so a stale loop's terminal/finally can't clobber the new
  // chat (matters when resuming or starting a new chat mid-stream).
  const epochRef = useRef(0);

  const active = state.agentKey === idOrSlug ? state : null;

  const dispatchClientTool = useCallback(
    async (
      data: Extract<AgentSessionEvent, { kind: "client_tool_call" }>["data"],
      sessionId: string,
    ) => {
      if (!ingressBaseUrl) return;
      const outcome = handleClientTool(data, idOrSlug);
      try {
        await client.sendAgentClientToolResult(
          ingressBaseUrl,
          sessionId,
          data.call_id,
          outcome,
        );
      } catch {
        // Best-effort — the session will time the call out if this fails.
      }
    },
    [client, ingressBaseUrl, idOrSlug],
  );

  const runStream = useCallback(
    async (sessionId: string) => {
      if (!ingressBaseUrl) return;
      // Supersede any in-flight stream (resume / new chat) and claim this epoch.
      abortRef.current?.abort();
      const epoch = ++epochRef.current;
      const controller = new AbortController();
      abortRef.current = controller;
      streamingRef.current = true;
      try {
        for await (const event of client.streamAgentSession(
          ingressBaseUrl,
          sessionId,
          controller.signal,
        )) {
          if (epochRef.current !== epoch) break;
          agentChatStore
            .getState()
            .appendMessages(mapperRef.current.apply(event));
          if (event.kind === "client_tool_call") {
            void dispatchClientTool(event.data, sessionId);
          } else if (event.kind === "completed") {
            agentChatStore.getState().setStatus("completed");
          } else if (event.kind === "waiting") {
            agentChatStore.getState().setStatus("awaiting_input");
          } else if (event.kind === "failed") {
            agentChatStore.getState().setStatus("failed");
            agentChatStore
              .getState()
              .setError(event.data?.reason ?? "The agent run failed.");
          }
        }
      } catch (err) {
        if (epochRef.current === epoch && !controller.signal.aborted) {
          agentChatStore
            .getState()
            .setError(err instanceof Error ? err.message : "Stream dropped.");
        }
      } finally {
        if (epochRef.current === epoch) {
          streamingRef.current = false;
          // Stream ended without a terminal frame mid-conversation → treat as
          // awaiting input so the composer stays usable.
          const s = agentChatStore.getState();
          if (s.status === "streaming") s.setStatus("awaiting_input");
        }
      }
    },
    [client, ingressBaseUrl, dispatchClientTool],
  );

  const start = useCallback(
    async (text: string) => {
      if (!ingressBaseUrl) return;
      mapperRef.current = createAgentChatMapper();
      const s = agentChatStore.getState();
      s.begin(idOrSlug);
      // Render the user's message immediately; the stream's echo is deduped.
      s.appendMessages(mapperRef.current.seedUserMessage(text));
      try {
        const { session_id } = await client.runAgentSession(
          ingressBaseUrl,
          text,
        );
        agentChatStore.getState().setSessionId(session_id);
        agentChatStore.getState().setStatus("streaming");
        // Index this chat locally so it shows in the rail — only sessions the
        // user started here, never the agent's full (customer) session list.
        recordChat(idOrSlug, {
          sessionId: session_id,
          title: text.slice(0, 120),
          startedAt: Date.now(),
        });
        void runStream(session_id);
      } catch (err) {
        agentChatStore.getState().setStatus("failed");
        agentChatStore
          .getState()
          .setError(
            err instanceof Error ? err.message : "Couldn't start chat.",
          );
      }
    },
    [client, ingressBaseUrl, idOrSlug, runStream, recordChat],
  );

  const send = useCallback(
    async (text: string) => {
      const s = agentChatStore.getState();
      if (!ingressBaseUrl || !s.sessionId) return start(text);
      // Render the user's message immediately; the stream's echo is deduped.
      s.appendMessages(mapperRef.current.seedUserMessage(text));
      s.setStatus("streaming");
      try {
        await client.sendAgentMessage(ingressBaseUrl, s.sessionId, text);
        if (!streamingRef.current) void runStream(s.sessionId);
      } catch (err) {
        s.setStatus("failed");
        s.setError(err instanceof Error ? err.message : "Couldn't send.");
      }
    },
    [client, ingressBaseUrl, start, runStream],
  );

  const cancel = useCallback(async () => {
    const s = agentChatStore.getState();
    abortRef.current?.abort();
    s.setStatus("cancelled");
    if (ingressBaseUrl && s.sessionId) {
      try {
        await client.cancelAgentSession(ingressBaseUrl, s.sessionId);
      } catch {
        // Best-effort.
      }
    }
  }, [client, ingressBaseUrl]);

  // Re-open a past preview chat. `/listen` only tails (it does not replay), so
  // history is rebuilt from the stored transcript; a still-active session then
  // attaches the live stream so the user can keep chatting where they left off.
  const resume = useCallback(
    async (sessionId: string) => {
      if (!ingressBaseUrl || agentChatStore.getState().sessionId === sessionId)
        return;
      abortRef.current?.abort();
      epochRef.current += 1;
      streamingRef.current = false;
      mapperRef.current = createAgentChatMapper();
      const s = agentChatStore.getState();
      s.begin(idOrSlug);
      s.setSessionId(sessionId);
      s.setStatus("starting");
      try {
        const detail = await client.getAgentApplicationSession(
          idOrSlug,
          sessionId,
        );
        // A newer resume/new-chat won the race while we were fetching.
        if (agentChatStore.getState().sessionId !== sessionId) return;
        const conversation = detail?.conversation ?? [];
        agentChatStore
          .getState()
          .appendMessages(conversationToAcpMessages(conversation));
        mapperRef.current.setPromptIdBase(
          conversation.filter((m) => m.role === "user").length,
        );
        if (!detail || TERMINAL_SESSION_STATES.has(detail.state)) {
          agentChatStore.getState().setStatus("completed");
        } else {
          agentChatStore.getState().setStatus("streaming");
          void runStream(sessionId);
        }
      } catch (err) {
        if (agentChatStore.getState().sessionId !== sessionId) return;
        agentChatStore.getState().setStatus("failed");
        agentChatStore
          .getState()
          .setError(
            err instanceof Error ? err.message : "Couldn't load this chat.",
          );
      }
    },
    [client, ingressBaseUrl, idOrSlug, runStream],
  );

  // Clear the surface for a brand-new chat; the next send starts a new session.
  const newChat = useCallback(() => {
    abortRef.current?.abort();
    epochRef.current += 1;
    streamingRef.current = false;
    mapperRef.current = createAgentChatMapper();
    agentChatStore.getState().reset();
  }, []);

  // Abort the stream when the consumer unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    messages: active?.messages ?? [],
    status: active?.status ?? "idle",
    error: active?.error ?? null,
    isStreaming:
      active?.status === "streaming" || active?.status === "starting",
    hasSession: !!active?.sessionId,
    sessionId: active?.sessionId ?? null,
    send,
    cancel,
    resume,
    newChat,
  };
}

/** Resolve a client-tool call. Immediate tools only; the rest degrade. */
function handleClientTool(
  data: Extract<AgentSessionEvent, { kind: "client_tool_call" }>["data"],
  agentSlug: string,
): { result?: unknown; error?: string } {
  switch (data.tool_id) {
    case "toast": {
      const args = (data.args ?? {}) as { message?: string; level?: string };
      const message = args.message ?? "";
      if (args.level === "error") toast.error(message);
      else if (args.level === "warn") toast.warning(message);
      else toast.info(message);
      return { result: { shown: true } };
    }
    case "get_context":
      return { result: { agent: agentSlug, client: "posthog-code" } };
    default:
      // focus_*, set_secret, … land with the concierge milestone.
      return { error: `unhandled_client_tool: ${data.tool_id}` };
  }
}
