# Agent Applications — port plan & status

> **TEMPORARY DOC — remove before merge.** This is the working plan for the
> agent-console → posthog/code port (PR #2700). It exists so the plan travels
> with the branch across sessions. Delete it before this PR is merged.

## Goal

Port the **agent-console** (deployed "agent applications") from
posthog/posthog's `ass` branch (`products/agent_platform/`) into posthog/code,
surfaced under `/code/agents`. Rather than porting the console's bespoke React
chat, deployed-agent conversations render through code's **native
`ConversationView`** via an SSE→ACP adapter, so deployed-agent chat looks and
behaves exactly like a local session.

## Information architecture

`/code/agents` is a two-tab surface (shared chrome: `AgentsTabLayout`):

- **Scouts** (`/code/agents/scouts`) — the existing scheduled-agent /
  self-driving configuration (`ConfigureAgentsSection`). Unchanged in content.
- **Applications** (`/code/agents/applications`) — deployed agent-platform
  applications: fleet stats, the agent list, per-agent detail, and session
  transcripts.

`/code/agents` redirects to the Scouts tab. Detail pages (a scout, an agent, a
session) keep their own focused chrome — the tab bar is only on the two list
views.

## Architecture decisions

- **Wire types** live in `@posthog/shared/agent-platform-types` (plain TS,
  snake_case, no Zod — matches `inbox-types.ts`).
- **Reads** live on `PostHogAPIClient` (raw fetcher + cast, mirroring the
  signals methods). No core service yet — with only reads it would be a
  forbidden trivial passthrough. UI calls via `useAuthenticatedQuery` hooks.
- **SSE→ACP mappers** are pure, unit-tested modules in
  `packages/ui/src/features/agent-applications/chat/`. They translate each
  agent_platform event into the equivalent ACP JSON-RPC message and let code's
  existing `buildConversationItems` do all the reduction (text accumulation,
  tool-call merging, turn tracking) — we do **not** re-implement the console's
  `runnerReducer`.
- Backend: `GET /api/projects/{teamId}/agent_applications/...` — these routes
  exist only on posthog/posthog's `ass` branch (the `agent_platform` Django
  app), not on production PostHog Cloud yet.

## Milestones

- [x] **M1** — IA scaffold: feature dir, routes, surfaced under `/code/agents`.
- [x] **M2** — read surface: shared types, `PostHogAPIClient` methods
  (apps / sessions / approvals / revisions / fleet), query hooks, list +
  per-agent detail views.
- [x] **M3** — SSE→ACP chat adapter:
  - [x] M3a — typed `AgentSessionEvent` SSE union + transcript content types.
  - [x] M3b — pure mappers (stored transcript + live SSE) → `AcpMessage[]`,
    18 unit tests.
  - [x] M3c — stored session transcripts render through `ConversationView`.
- [x] **Tabs** — split Agents into Scouts + Applications tabs.
- [ ] **M4** — live chat: SSE transport (EventSource against agent-ingress),
  send a message, client tools, approvals (ACP tool-call permissions). The
  `createAgentChatMapper()` is built + tested; M4 wires it to the live stream.
  Open question: where the cloud-SSE transport lives in code's layered model
  (no existing precedent — the console used a browser `EventSource` against a
  Next.js proxy that injected the OAuth bearer).
- [ ] **M5** — concierge ("agent concierge" drives UI edits/config) + config
  editor; optional standalone deployed-agent chat package.

## What's demoable today (M1–M3 + tabs)

Requires the app authenticated against a PostHog backend that has the
`agent_platform` app deployed (i.e. the `ass` branch). Against production
Cloud the data endpoints 404, so the data surfaces show error/empty states —
the UI shell, tabs, and navigation still work.

With a backend that has deployed agents + sessions:

- `/code/agents` → **Scouts / Applications tabs**.
- **Applications tab**: fleet stat strip (live / sessions / spend / failures /
  approvals) + the list of deployed agents.
- **Per-agent detail**: overview stat strip + recent sessions list.
- **Session transcript**: a stored session rendered read-only through code's
  native chat UI (streaming text, thinking, tool calls + results).

Not yet built: live streaming, sending messages, approvals, config editing
(M4/M5). The transcript view is read-only playback.
