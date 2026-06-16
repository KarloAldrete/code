// Domain types for the agent_platform product surface (deployed agents,
// their revisions, sessions, approvals, and fleet rollups). These mirror the
// PostHog Cloud REST serializers (Django app `agent_platform`) and are the wire
// shapes returned by the corresponding PostHogAPIClient methods. Field names
// stay snake_case to match the JSON exactly, as with the other shared wire
// types (see inbox-types.ts).

// --- Enums -----------------------------------------------------------------

export type AgentSessionState =
  | "queued"
  | "running"
  | "completed"
  | "closed"
  | "cancelled"
  | "failed";

export type AgentSessionPrincipalKind =
  | "anonymous"
  | "service"
  | "internal"
  | "shared_secret"
  | "slack";

export type AgentRevisionState = "draft" | "ready" | "live" | "archived";

export type AgentApprovalRequestState =
  | "queued"
  | "approving"
  | "dispatched"
  | "dispatched_failed"
  | "rejected"
  | "expired";

export type AgentApprovalDecision = "approve" | "reject";

// --- Applications ----------------------------------------------------------

/** Resolved creator (from `created_by_id`), or null if unset/deleted. */
export interface AgentApplicationCreator {
  id?: number;
  first_name?: string;
  email?: string;
}

export interface AgentApplication {
  id: string;
  team_id: number;
  name: string;
  /** Globally-unique URL identifier; server-minted unless explicitly allowed. */
  slug?: string;
  description?: string;
  live_revision: string | null;
  archived?: boolean;
  archived_at: string | null;
  created_by_id: number | null;
  created_by: AgentApplicationCreator | null;
  created_at: string;
  updated_at: string;
  /** Slack Event Subscriptions request URL; null without a public ingress URL. */
  slack_events_url: string | null;
  /** Slack Interactivity request URL; null without a public ingress URL. */
  slack_interactivity_url: string | null;
  /** Mode-aware base URL the agent's trigger routes hang off; null without ingress. */
  ingress_base_url: string | null;
}

/** Per-application or team-wide roll-up stats. */
export interface AgentAggregateStats {
  liveCount: number;
  sessionsInWindowCount: number;
  spendInWindowUsd: number;
  lastActivityAt: string | null;
  failedInWindowCount: number;
  pendingApprovalsCount: number;
}

// --- Revisions -------------------------------------------------------------

/**
 * The agent spec carried on a revision. Fully typed elaboration (triggers,
 * tools, mcps, skills, limits) lands with the config editor milestone; for now
 * the known top-level fields are surfaced and the rest passes through.
 */
export interface AgentSpec {
  model: string;
  triggers?: unknown[];
  tools?: unknown[];
  mcps?: unknown[];
  skills?: unknown[];
  integrations?: string[];
  secrets?: string[];
  limits?: {
    max_turns?: number;
    max_tool_calls?: number;
    max_wall_seconds?: number;
  };
  entrypoint?: string;
  reasoning?: "minimal" | "low" | "medium" | "high" | "xhigh";
  [key: string]: unknown;
}

export interface AgentRevision {
  id: string;
  application: string;
  parent_revision?: string | null;
  state: AgentRevisionState;
  bundle_uri?: string;
  bundle_sha256: string | null;
  spec?: AgentSpec;
  created_by_id: number | null;
  created_by: AgentApplicationCreator | null;
  created_at: string;
  updated_at: string;
}

// --- Sessions --------------------------------------------------------------

export interface AgentSessionUsageTotal {
  tokens_in: number;
  tokens_out: number;
  cache_read: number;
  cache_write: number;
  cost_input: number;
  cost_output: number;
  cost_cache_read: number;
  cost_cache_write: number;
  cost_total: number;
}

export interface AgentSessionPrincipal {
  kind: AgentSessionPrincipalKind;
  /** Stable principal id (PAT id, slack user id, …); absent for anonymous. */
  id?: string;
  team_id?: number;
}

/** Trigger-specific metadata stamped at session creation; shape varies by kind. */
export type AgentSessionTriggerMetadata = Record<string, unknown>;

export interface AgentSessionSummary {
  id: string;
  application_id: string;
  revision_id: string;
  state: AgentSessionState;
  external_key: string | null;
  trigger_metadata?: AgentSessionTriggerMetadata | null;
  principal: AgentSessionPrincipal | null;
  /** Count of messages in the conversation. */
  turns: number;
  /** Last assistant text (~120 chars); null before any assistant turn. */
  preview: string | null;
  usage_total: AgentSessionUsageTotal;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface AgentApplicationSessionsListResponse {
  results: AgentSessionSummary[];
  count: number;
}

// --- Conversation transcript (stored shape on a session) -------------------
// The runtime persists pi-ai's `conversation` array. The SSE→ACP adapter and
// the session-detail transcript both narrow these `content` parts at runtime.
// Part shapes mirror what the agent-console apiClient narrows (text/thinking/
// toolCall for assistants; text/image for users; text for tool results).

export interface AgentTextPart {
  type: "text";
  text: string;
}

export interface AgentThinkingPart {
  type: "thinking";
  thinking: string;
}

export interface AgentImagePart {
  type: "image";
  [key: string]: unknown;
}

export interface AgentToolCallPart {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export type AgentAssistantContentPart =
  | AgentTextPart
  | AgentThinkingPart
  | AgentToolCallPart;

export type AgentUserContentPart = AgentTextPart | AgentImagePart;

export interface AgentConversationUserMessage {
  role: "user";
  /** String shorthand, or an array of text/image parts. */
  content: string | AgentUserContentPart[];
  /** Epoch milliseconds. */
  timestamp: number;
}

export interface AgentConversationAssistantMessage {
  role: "assistant";
  /** Array of text/thinking/toolCall parts. */
  content: AgentAssistantContentPart[];
  timestamp: number;
  api?: string;
  provider?: string;
  model?: string;
  usage?: Record<string, unknown>;
  stopReason?: string;
  errorMessage?: string;
}

export interface AgentConversationToolResultMessage {
  /** Wire value is `toolResult` (NOT `tool`) — matches the runtime serializer. */
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  /** Array of text parts (image parts are dropped on render). */
  content: AgentTextPart[];
  isError: boolean;
  timestamp: number;
}

export type AgentConversationMessage =
  | AgentConversationUserMessage
  | AgentConversationAssistantMessage
  | AgentConversationToolResultMessage;

export interface AgentApplicationSessionDetail {
  id: string;
  application_id: string;
  revision_id: string;
  team_id: number;
  state: AgentSessionState;
  external_key: string | null;
  trigger_metadata?: AgentSessionTriggerMetadata | null;
  principal: AgentSessionPrincipal | null;
  usage_total: AgentSessionUsageTotal;
  conversation: AgentConversationMessage[];
  /** Messages that arrived while a turn was in flight. */
  pending_inputs: AgentConversationMessage[];
  retry_count: number;
  created_at: string;
  updated_at: string;
  /** True when `last_n` was supplied AND the full conversation exceeded it. */
  conversation_trimmed: boolean;
  /** Total messages in the untrimmed conversation; present only when trimmed. */
  conversation_total_turns?: number;
}

// --- Session logs ----------------------------------------------------------
// `…/sessions/{id}/logs/` returns rows from the shared ClickHouse `log_entries`
// table via `fetch_log_entries` — the same flat shape hog_function logs use.

export type AgentLogLevel = "DEBUG" | "LOG" | "INFO" | "WARN" | "ERROR";

export interface AgentSessionLogEntry {
  log_source_id: string;
  instance_id: string;
  /** ISO timestamp. */
  timestamp: string;
  /** One of AgentLogLevel, but server may emit other casings — keep it open. */
  level: string;
  message: string;
}

export interface AgentSessionLogsParams {
  limit?: number;
  /** Comma-separated levels server-side; pass an array, joined by the client. */
  level?: AgentLogLevel[];
  search?: string;
  after?: string;
  before?: string;
}

// --- Fleet -----------------------------------------------------------------

export interface AgentFleetLiveSessionSummary {
  id: string;
  application_id: string;
  revision_id: string;
  team_id: number;
  state: AgentSessionState;
  external_key: string | null;
  trigger_metadata?: AgentSessionTriggerMetadata | null;
  principal: AgentSessionPrincipal | null;
  turns: number;
  preview: string | null;
  usage_total: AgentSessionUsageTotal;
  created_at: string;
  updated_at: string;
}

export interface AgentFleetLiveSessionsResponse {
  results: AgentFleetLiveSessionSummary[];
}

// --- Approvals -------------------------------------------------------------

export interface AgentApprovalRequest {
  id: string;
  session_id: string;
  application_id: string;
  team_id: number;
  revision_id: string;
  turn: number;
  tool_call_id: string;
  tool_name: string;
  proposed_args: Record<string, unknown>;
  decided_args: Record<string, unknown> | null;
  assistant_message: Record<string, unknown>;
  approver_scope: Record<string, unknown>;
  state: AgentApprovalRequestState;
  decision_by: string | null;
  decision_at: string | null;
  decision_reason: string | null;
  dispatch_outcome: Record<string, unknown> | null;
  created_at: string;
  expires_at: string;
}

/** Body for POST …/approvals/{id}/decide/. */
export interface DecideApprovalRequest {
  decision: AgentApprovalDecision;
  /** Honoured only when the tool's approval_policy.allow_edit is true. */
  edited_args?: Record<string, unknown>;
  reason?: string;
}

// --- Query params ----------------------------------------------------------

export interface AgentSessionsListParams {
  limit?: number;
  offset?: number;
  /** Comma-separated states accepted server-side; pass an array, joined by the client. */
  state?: AgentSessionState[];
  revision_id?: string;
  created_after?: string;
  created_before?: string;
}

export interface AgentApprovalsListParams {
  state?: AgentApprovalRequestState;
  agent_id?: string;
  limit?: number;
  offset?: number;
}

// --- Live session events (agent-ingress SSE stream) ------------------------
// The chat trigger's `/listen` endpoint streams these as `text/event-stream`
// JSON frames. The SSE→ACP adapter folds them into ACP messages the native
// ConversationView renders. The `kind` discriminator and `data` payloads come
// from `agent-ingress/src/triggers/chat.ts` + `agent-runner/src/loop/bus.ts`.

interface AgentSessionEventBase {
  session_id: string;
  /** ISO timestamp the runner stamped on the frame. */
  ts: string;
}

/** Session accepted and the runner started — `{ team_id, agent, rev }`. */
export type AgentSessionStartedEvent = AgentSessionEventBase & {
  kind: "session_started";
  data: { team_id?: number; agent?: string; rev?: string };
};

/** Server-confirmed user message, echoed when drained from `pending_inputs`. */
export type AgentUserMessageEvent = AgentSessionEventBase & {
  kind: "user_message";
  data: { text: string; timestamp?: string };
};

/** A new assistant turn began — `{ turn }` is the turn index. */
export type AgentTurnStartedEvent = AgentSessionEventBase & {
  kind: "turn_started";
  data: { turn?: number };
};

/** Streaming assistant text fragment. */
export type AgentAssistantTextDeltaEvent = AgentSessionEventBase & {
  kind: "assistant_text_delta";
  data: { turn?: number; text: string };
};

/** Streaming assistant thinking fragment. */
export type AgentAssistantThinkingDeltaEvent = AgentSessionEventBase & {
  kind: "assistant_thinking_delta";
  data: { turn?: number; thinking: string };
};

/** A tool call appeared (name known, args still streaming). */
export type AgentToolCallStartEvent = AgentSessionEventBase & {
  kind: "tool_call_start";
  data: { turn?: number; id: string; name: string };
};

/** Incremental tool-call args — string fragment or partial object. */
export type AgentToolCallArgsDeltaEvent = AgentSessionEventBase & {
  kind: "tool_call_args_delta";
  data: { turn?: number; id: string; argsDelta: unknown };
};

/** Turn-end snapshot of the full assistant text (deltas already filled it). */
export type AgentAssistantTextEvent = AgentSessionEventBase & {
  kind: "assistant_text";
  data: { text: string };
};

/** Canonical tool call with finalized args. */
export type AgentToolCallEvent = AgentSessionEventBase & {
  kind: "tool_call";
  data: { id: string; name: string; args?: Record<string, unknown> };
};

/** Tool result — `ok` plus `output` on success, `error` on failure. */
export type AgentToolResultEvent = AgentSessionEventBase & {
  kind: "tool_result";
  data: {
    id: string;
    tool?: string;
    ok?: boolean;
    output?: unknown;
    error?: string;
  };
};

/** Turn finished; session stays open for more input. */
export type AgentCompletedEvent = AgentSessionEventBase & {
  kind: "completed";
  data: { turns?: number; summary?: unknown };
};

/** Session parked for a steering message (`@posthog/meta-ask-for-input`). */
export type AgentWaitingEvent = AgentSessionEventBase & {
  kind: "waiting";
  data: { turns?: number; prompt?: string };
};

/** Terminal failure — `reason` is for owners/logs, not end users. */
export type AgentFailedEvent = AgentSessionEventBase & {
  kind: "failed";
  data: { reason?: string; turns?: number };
};

/** Session sealed (terminal); no further `/send`s accepted. */
export type AgentClosedEvent = AgentSessionEventBase & {
  kind: "closed";
  data: Record<string, unknown>;
};

/** Model invoked a client-fulfilled tool; the host runs it and posts back. */
export type AgentClientToolCallEvent = AgentSessionEventBase & {
  kind: "client_tool_call";
  data: { call_id: string; tool_id: string; args?: Record<string, unknown> };
};

/** A client tool's outcome landed (sync POST or interactive `/send` wake). */
export type AgentClientToolResultEvent = AgentSessionEventBase & {
  kind: "client_tool_result";
  data: { call_id: string; result?: unknown; error?: string };
};

export type AgentSessionEvent =
  | AgentSessionStartedEvent
  | AgentUserMessageEvent
  | AgentTurnStartedEvent
  | AgentAssistantTextDeltaEvent
  | AgentAssistantThinkingDeltaEvent
  | AgentToolCallStartEvent
  | AgentToolCallArgsDeltaEvent
  | AgentAssistantTextEvent
  | AgentToolCallEvent
  | AgentToolResultEvent
  | AgentCompletedEvent
  | AgentWaitingEvent
  | AgentFailedEvent
  | AgentClosedEvent
  | AgentClientToolCallEvent
  | AgentClientToolResultEvent;

/** Discriminator values for {@link AgentSessionEvent}. */
export type AgentSessionEventKind = AgentSessionEvent["kind"];
