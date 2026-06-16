import { agentChatStore } from "@posthog/core/agent-chat/agentChatStore";
import type { AgentSessionEvent } from "@posthog/shared/agent-platform-types";
import { useAuthenticatedClient } from "@posthog/ui/features/auth/authClient";
import { toast } from "@posthog/ui/primitives/toast";
import { useCallback, useEffect, useRef } from "react";
import { useStore } from "zustand";
import { useChatHistoryStore } from "../chat/chatHistoryStore";
import { buildConsoleContextEnvelope } from "../chat/consoleContext";
import { conversationToAcpMessages } from "../chat/conversationToAcp";
import {
  type AgentChatMapper,
  createAgentChatMapper,
} from "../chat/sessionEventToAcp";

type ClientToolCall = Extract<
  AgentSessionEvent,
  { kind: "client_tool_call" }
>["data"];

export type ClientToolOutcome = { result?: unknown; error?: string };

/**
 * Resolves a client-tool call, or returns null to defer to the built-in
 * handlers (toast / get_context). Used by the concierge to drive the UI
 * (focus_*) and the secret punch-out.
 */
export type ClientToolHandler = (
  data: ClientToolCall,
) => ClientToolOutcome | null | Promise<ClientToolOutcome | null>;

/** Session states with no further activity to tail — render stored history only. */
const TERMINAL_SESSION_STATES = new Set([
  "completed",
  "closed",
  "cancelled",
  "failed",
]);

export interface UseAgentChatOptions {
  /** Opaque key isolating this chat in the store (e.g. "concierge", "preview:<slug>"). */
  chatId: string;
  /** Agent slug the chat targets (drives client-tool context + history). */
  agentSlug: string;
  ingressBaseUrl: string | null;
  /** Index started sessions in the local recent-chats rail (preview only). */
  recordHistory?: boolean;
  /**
   * Supplies the "what am I looking at" object. When set, it's prepended as a
   * delimited envelope to the first message and answers the `get_context`
   * client tool. Concierge only.
   */
  contextProvider?: () => unknown;
  /** Concierge UI-driving tools (focus_*, set_secret); null → built-in handling. */
  clientTools?: ClientToolHandler;
}

/**
 * Drives a live chat against a deployed agent's ingress: starts/sends/cancels
 * via the api-client, streams SSE through the M3 `createAgentChatMapper`, and
 * pumps the resulting ACP messages into the core `agentChatStore` under `chatId`
 * (so the concierge dock and a per-agent preview coexist). Components read the
 * chat by id and render through `ConversationView`.
 *
 * Transport lives here (the api-client is renderer/hook-scoped); state lives in
 * core. Client tools are dispatched here — `toast`/`get_context` are handled;
 * `focus_*`/`set_secret` degrade to `unhandled_client_tool` until the concierge
 * milestone wires UI-driving + the inline secret form.
 */
export function useAgentChat({
  chatId,
  agentSlug,
  ingressBaseUrl,
  recordHistory = false,
  contextProvider,
  clientTools,
}: UseAgentChatOptions) {
  const client = useAuthenticatedClient();
  const chat = useStore(agentChatStore, (s) => s.chats[chatId]);
  const recordChat = useChatHistoryStore((s) => s.record);
  const mapperRef = useRef<AgentChatMapper>(createAgentChatMapper());
  const abortRef = useRef<AbortController | null>(null);
  const streamingRef = useRef(false);
  // Latest provider/handler without re-creating the stream callbacks each render.
  const contextProviderRef = useRef(contextProvider);
  contextProviderRef.current = contextProvider;
  const clientToolsRef = useRef(clientTools);
  clientToolsRef.current = clientTools;
  // Each stream attach bumps this; an aborted/superseded loop checks it before
  // touching the store so a stale loop's terminal/finally can't clobber the new
  // chat (matters when resuming or starting a new chat mid-stream).
  const epochRef = useRef(0);

  const dispatchClientTool = useCallback(
    async (
      data: Extract<AgentSessionEvent, { kind: "client_tool_call" }>["data"],
      sessionId: string,
    ) => {
      if (!ingressBaseUrl) return;
      // 1) concierge handler (focus_*, set_secret), 2) get_context from the
      // context provider, 3) built-in toast / unhandled fallback.
      let outcome = (await clientToolsRef.current?.(data)) ?? null;
      if (outcome == null && data.tool_id === "get_context") {
        outcome = {
          result: contextProviderRef.current?.() ?? {
            agent: agentSlug,
            client: "posthog-code",
          },
        };
      }
      if (outcome == null) outcome = handleClientTool(data, agentSlug);
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
    [client, ingressBaseUrl, agentSlug],
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
      const store = agentChatStore.getState();
      try {
        for await (const event of client.streamAgentSession(
          ingressBaseUrl,
          sessionId,
          controller.signal,
        )) {
          if (epochRef.current !== epoch) break;
          store.appendMessages(chatId, mapperRef.current.apply(event));
          if (event.kind === "client_tool_call") {
            void dispatchClientTool(event.data, sessionId);
          } else if (event.kind === "completed") {
            store.setStatus(chatId, "completed");
          } else if (event.kind === "waiting") {
            store.setStatus(chatId, "awaiting_input");
          } else if (event.kind === "failed") {
            store.setStatus(chatId, "failed");
            store.setError(
              chatId,
              event.data?.reason ?? "The agent run failed.",
            );
          }
        }
      } catch (err) {
        if (epochRef.current === epoch && !controller.signal.aborted) {
          store.setError(
            chatId,
            err instanceof Error ? err.message : "Stream dropped.",
          );
        }
      } finally {
        if (epochRef.current === epoch) {
          streamingRef.current = false;
          // Stream ended without a terminal frame mid-conversation → treat as
          // awaiting input so the composer stays usable.
          if (agentChatStore.getState().chats[chatId]?.status === "streaming") {
            agentChatStore.getState().setStatus(chatId, "awaiting_input");
          }
        }
      }
    },
    [client, ingressBaseUrl, chatId, dispatchClientTool],
  );

  const start = useCallback(
    async (text: string) => {
      if (!ingressBaseUrl) return;
      mapperRef.current = createAgentChatMapper();
      const s = agentChatStore.getState();
      s.begin(chatId, agentSlug);
      // Render the user's clean message immediately; the stream's echo (which
      // includes the context envelope) is stripped + deduped by the mapper.
      s.appendMessages(chatId, mapperRef.current.seedUserMessage(text));
      const envelope = contextProviderRef.current?.();
      const wireText = envelope
        ? `${buildConsoleContextEnvelope(envelope)}\n\n${text}`
        : text;
      try {
        const { session_id } = await client.runAgentSession(
          ingressBaseUrl,
          wireText,
        );
        agentChatStore.getState().setSessionId(chatId, session_id);
        agentChatStore.getState().setStatus(chatId, "streaming");
        // Index this chat locally so it shows in the rail — only sessions the
        // user started here, never the agent's full (customer) session list.
        if (recordHistory) {
          recordChat(agentSlug, {
            sessionId: session_id,
            title: text.slice(0, 120),
            startedAt: Date.now(),
          });
        }
        void runStream(session_id);
      } catch (err) {
        agentChatStore.getState().setStatus(chatId, "failed");
        agentChatStore
          .getState()
          .setError(
            chatId,
            err instanceof Error ? err.message : "Couldn't start chat.",
          );
      }
    },
    [
      client,
      ingressBaseUrl,
      chatId,
      agentSlug,
      runStream,
      recordHistory,
      recordChat,
    ],
  );

  const send = useCallback(
    async (text: string) => {
      const s = agentChatStore.getState();
      const sessionId = s.chats[chatId]?.sessionId;
      if (!ingressBaseUrl || !sessionId) return start(text);
      // Render the user's message immediately; the stream's echo is deduped.
      s.appendMessages(chatId, mapperRef.current.seedUserMessage(text));
      s.setStatus(chatId, "streaming");
      try {
        await client.sendAgentMessage(ingressBaseUrl, sessionId, text);
        if (!streamingRef.current) void runStream(sessionId);
      } catch (err) {
        s.setStatus(chatId, "failed");
        s.setError(
          chatId,
          err instanceof Error ? err.message : "Couldn't send.",
        );
      }
    },
    [client, ingressBaseUrl, chatId, start, runStream],
  );

  const cancel = useCallback(async () => {
    const s = agentChatStore.getState();
    const sessionId = s.chats[chatId]?.sessionId;
    abortRef.current?.abort();
    s.setStatus(chatId, "cancelled");
    if (ingressBaseUrl && sessionId) {
      try {
        await client.cancelAgentSession(ingressBaseUrl, sessionId);
      } catch {
        // Best-effort.
      }
    }
  }, [client, ingressBaseUrl, chatId]);

  // Re-open a past preview chat. `/listen` only tails (it does not replay), so
  // history is rebuilt from the stored transcript; a still-active session then
  // attaches the live stream so the user can keep chatting where they left off.
  const resume = useCallback(
    async (sessionId: string) => {
      if (
        !ingressBaseUrl ||
        agentChatStore.getState().chats[chatId]?.sessionId === sessionId
      )
        return;
      abortRef.current?.abort();
      epochRef.current += 1;
      streamingRef.current = false;
      mapperRef.current = createAgentChatMapper();
      const s = agentChatStore.getState();
      s.begin(chatId, agentSlug);
      s.setSessionId(chatId, sessionId);
      s.setStatus(chatId, "starting");
      try {
        const detail = await client.getAgentApplicationSession(
          agentSlug,
          sessionId,
        );
        // A newer resume/new-chat won the race while we were fetching.
        if (agentChatStore.getState().chats[chatId]?.sessionId !== sessionId)
          return;
        const conversation = detail?.conversation ?? [];
        agentChatStore
          .getState()
          .appendMessages(chatId, conversationToAcpMessages(conversation));
        mapperRef.current.setPromptIdBase(
          conversation.filter((m) => m.role === "user").length,
        );
        if (!detail || TERMINAL_SESSION_STATES.has(detail.state)) {
          agentChatStore.getState().setStatus(chatId, "completed");
        } else {
          agentChatStore.getState().setStatus(chatId, "streaming");
          void runStream(sessionId);
        }
      } catch (err) {
        if (agentChatStore.getState().chats[chatId]?.sessionId !== sessionId)
          return;
        agentChatStore.getState().setStatus(chatId, "failed");
        agentChatStore
          .getState()
          .setError(
            chatId,
            err instanceof Error ? err.message : "Couldn't load this chat.",
          );
      }
    },
    [client, ingressBaseUrl, chatId, agentSlug, runStream],
  );

  // Clear the surface for a brand-new chat; the next send starts a new session.
  const newChat = useCallback(() => {
    abortRef.current?.abort();
    epochRef.current += 1;
    streamingRef.current = false;
    mapperRef.current = createAgentChatMapper();
    agentChatStore.getState().reset(chatId);
  }, [chatId]);

  // Abort the stream when the consumer unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  return {
    messages: chat?.messages ?? [],
    status: chat?.status ?? "idle",
    error: chat?.error ?? null,
    isStreaming: chat?.status === "streaming" || chat?.status === "starting",
    hasSession: !!chat?.sessionId,
    sessionId: chat?.sessionId ?? null,
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
