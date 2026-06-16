# Agent Applications — port plan & status

> **TEMPORARY DOC — remove before merge.** This is the working plan for the
> agent-console → posthog/code port (PR #2700). It exists so the plan travels
> with the branch across sessions. Delete it before this PR is merged.

## Goal

Port the **agent-console** (deployed "agent applications") from
posthog/posthog's `ass` branch into posthog/code, surfaced under
`/code/agents`. The aim is **functional parity** with the console — every core
capability an operator has in the console should exist in code. We are **not**
porting the console's code; we re-implement each feature in code's layered
architecture and visual style. Where it makes sense, deployed-agent
conversations render through code's **native `ConversationView`** via an
SSE→ACP adapter, so deployed-agent chat looks and behaves like a local session.

The console source of truth lives at
`products/agent_platform/services/agent-console` (Next.js) on the `ass` branch;
the Django API it consumes lives at `products/agent_platform/backend`.

## Information architecture

`/code/agents` is a two-tab surface (shared chrome: `AgentsTabLayout`):

- **Scouts** (`/code/agents/scouts`) — the existing scheduled-agent /
  self-driving configuration (`ConfigureAgentsSection`). Unchanged in content.
- **Applications** (`/code/agents/applications`) — deployed agent-platform
  applications. This is where the entire console surface lands.

`/code/agents` redirects to the Scouts tab. The tab bar lives only on the two
list views; detail pages (a scout, an agent, a session) keep their own focused
chrome.

### Applications-tab IA (target)

The console had top-level surfaces + per-agent sub-tabs. In code they all sit
under the Applications tab:

**Applications landing / fleet surfaces**
- **Fleet overview** — stat strip (agents / live now / sessions·24h / spend·24h
  / failures / pending approvals), **live-now panel** (cross-agent in-flight
  sessions), recent activity, quick links.
- **Agent list** — all deployed agents with per-agent inline stats; filter by
  All / Live / Drafts / Archived.
- **Global approvals queue** — fleet-wide inbox of approval-gated tool calls.
- **Fleet analytics** — cross-agent `$ai_*` observability dashboard.

> Billing (AI-gateway wallet / ledger) and the Registry (skills / custom tools
> / native-tool catalog) are **out of scope here** — owned elsewhere.

**Per-agent detail sub-tabs** (`/applications/{slug}/…`)
- **Overview** — status, triggers, live revision, recent activity, observability
  links.
- **Sessions** — filterable session history → session detail (Conversation +
  **Logs** panes).
- **Approvals** — this agent's approval queue.
- **Configuration** — spec explorer (model / instructions / triggers / tools /
  skills / mcps / integrations / limits) + bundle file viewer + revisions.
- **Secrets** — encrypted env management.
- **Memory** — S3-backed file store + tables.
- **Connections** — Slack setup + integrations.
- **Observability** — per-agent observability **summary page**.

## Architecture decisions

- **Authoring is the concierge's job; this surface renders.** Agents are
  created and edited only through the agent concierge (a meta-agent you chat
  with), never through hand-built config forms. So the Applications surface is
  **render-first**: it shows how an agent is configured (spec, revisions,
  secrets, memory, connections) and exposes only **operational** mutations —
  enable/disable an agent, and promote / freeze / archive a revision. There is
  **no** spec editor, bundle file editor, trigger-config form, or secret-value
  editor. (This retires most of the old M12 "authoring" milestone.)
- **Functional parity, not code reuse.** Re-implement each console feature to
  code's conventions (Inversify services, `useAuthenticatedQuery` hooks,
  Tailwind/Radix, `@posthog/quill`). The console's React is a behavioral spec,
  not a source to copy.
- **Wire types** live in `@posthog/shared/agent-platform-types` (plain TS,
  snake_case, no Zod — matches `inbox-types.ts`). Already covers applications,
  stats, sessions, approvals, revisions, fleet, SSE events. Still **missing**
  types for: memory files/tables, env keys, bundle/manifest, analytics
  rollups, system-prompt render, validation, preview tokens.
- **Reads** live on `PostHogAPIClient` (raw fetcher + cast, mirroring the
  signals methods). UI calls via `useAuthenticatedQuery` hooks. The read methods
  for apps / stats / sessions / approvals / revisions / fleet already exist.
- **Mutations & lifecycle** (approve/reject, freeze/promote/archive/rollback,
  set_env, memory CRUD, file writes, cron-fire, preview) are **not** trivial
  passthroughs — they carry orchestration, optimistic state and cross-resource
  effects (e.g. promote rewrites `live_revision`). These cross the threshold
  into a **`@posthog/core` AgentApplications service** rather than living as raw
  client methods. Decide per-feature; flag in each milestone.
- **SSE→ACP mappers** are pure, unit-tested modules in
  `packages/ui/src/features/agent-applications/chat/`. They translate each
  agent_platform event into the equivalent ACP JSON-RPC message and let code's
  existing `buildConversationItems` do the reduction — we do **not**
  re-implement the console's `runnerReducer`.
- **Analytics** read the team's own PostHog project `$ai_*` events via the
  `/query/` HogQL endpoint on `PostHogAPIClient`, not a bespoke service.
- Backend routes (`GET /api/projects/{teamId}/agent_applications/…`,
  `/agent_fleet/…`) exist only on posthog/posthog's `ass` branch, not
  production Cloud yet.

## Feature parity map

Status legend: **✅ done** · **🟡 API-ready** (client method/types exist, UI not
built) · **⬜ missing** (needs types + client + UI) · **🔴 live** (needs SSE
transport, blocked on the M-Live open question).

| # | Feature | What it does | Backend | Status |
|---|---------|--------------|---------|--------|
| **Browsing & monitoring** ||||
| 1 | Fleet overview / stat strip | Aggregate KPIs across all agents | `/query/` HogQL `$ai_*` | ✅ (analytics KPIs: spend/sessions/failure/p95 + trends + WoW deltas on the Applications overview; operational live-now/approvals counts dropped — see M6) |
| 2 | Live-now panel | Cross-agent in-flight sessions, live state dots | `agent_fleet/live_sessions/` | 🟡 |
| 3 | Agent list + filters | All agents, per-agent inline stats, All/Live/Drafts/Archived | `agent_applications/`, `/query/` | ✅ list + inline stats / 🟡 filters |
| 4 | Per-agent overview | Status, triggers, live revision, recent activity | `agent_applications/{slug}/` | ✅ |
| 5 | Session list + filters | History; filter by state / revision / date; pagination | `…/sessions/?state=&revision_id=&…` | ✅ (state filter + load-more; date/revision filters pending) |
| 6 | Session transcript | Stored transcript via native `ConversationView` | (mapper) | ✅ |
| 7 | Session KPI strip + "fired by" | Per-session messages/tools/cost/duration/errors; cron badge | (in session detail) | ✅ |
| 8 | **Session logs pane** | Structured log viewer, level filter + search | `…/sessions/{id}/logs/` | ✅ |
| **Approvals** ||||
| 9 | Per-agent approvals queue | List approval-gated tool calls, filter by state | `…/approvals/` | ✅ |
| 10 | Global approvals queue | Fleet-wide approval inbox | `agent_fleet/approvals/` | 🟡 (client ready; UI pending) |
| 11 | Approval detail + decide | Reasoning snapshot, proposed args, approve/reject + edit args + reason; embedded session | `…/approvals/{id}/decide/` | ✅ (master/detail) |
| **Configuration & authoring** ||||
| 12 | Spec explorer | Filesystem-style view of model/triggers/tools/skills/mcps/integrations/secrets/limits | revision `spec` JSONB | ✅ |
| 13 | Bundle file viewer | Tree + read file (markdown/code/json), via reusable `FileExplorer` | `…/revisions/{id}/bundle/` | ✅ |
| 14 | Revision list + lifecycle | picker (drives explorer) + freeze(ready) → promote(live) → archive | `…/revisions/`, `/freeze/`, `/promote/`, `/archive/` | ✅ |
| 15 | Spec editing + validate | Edit spec on a draft, validate, render system prompt | `…/revisions/{id}/` PATCH | ~~retired~~ (concierge authors) |
| 16 | Bundle file editing | Write/delete files, bulk bundle upload | `…/revisions/{id}/file/` PUT/DELETE | ~~retired~~ (concierge authors) |
| 17 | Trigger config | chat / webhook / mcp / slack / cron + auth modes + endpoints/usage | revision `spec` | ✅ (view; editing retired) |
| 18 | Cron fire (run-now) | Manually fire a cron out-of-band to test → jump to session | `…/revisions/{id}/cron/fire/` | ✅ |
| **Secrets & env** ||||
| 19 | Env / secrets management | List keys, set/rotate/clear per key (guarded), discover required secrets from spec | `…/env_keys/…` | ✅ |
| **Memory** ||||
| 20 | Memory file store | Tree + read file (markdown); create/update/delete | `…/memory/files/`, `/tree/`, `/by_path/` | 🟡 (read in progress; edit deferred) |
| 21 | Memory search | BM25 full-text search (FileExplorer search mode) | `…/memory/search/?q=` | 🟡 (in progress) |
| 22 | Memory tables | List tables + read rows | `…/memory/tables/…` | 🟡 (in progress) |
| **Connections** ||||
| 23 | Slack setup | Derived Slack app manifest + request URLs (under the slack trigger) | `…/revisions/{id}/slack_manifest/` | ✅ |
| 24 | Integrations | PostHog integrations attached to an agent | (spec `integrations` + integ API) | ⬜ (view stub) |
| **Observability & analytics** ||||
| 25 | Per-agent observability summary | Rollup: spend, sessions, failure rate, p95 (+ trends/deltas), cost-by-model, tool reliability for this agent | `/query/` HogQL `$ai_*` | ✅ (Observability tab + KPIs on the Overview tab) |
| 26 | Fleet analytics dashboard | Cross-agent KPIs + WoW deltas, spend/cost, tool reliability | `/query/` HogQL `$ai_*` | ✅ (blended into the Applications overview: KPI strip + per-agent row stats; cost-by-model + tool reliability on the per-agent tab) |
| **Live & interactive** ||||
| 27 | Live chat / streaming | SSE transport → ACP; send message; cancel; new/resume chats | ingress `/agents/{slug}/run\|send\|listen\|cancel` | ✅ (per-agent **Chat** preview tab — region-derived ingress, optimistic send, info banner, local recent-chats rail with transcript-rebuilding resume; commit `c0688cfa`) |
| 28 | In-chat approvals | ACP tool-call permission prompts during a live turn | ingress + approvals | 🔴 |
| 29 | Draft preview | Run a non-live draft revision live before promoting | `…/preview-proxy/…`, `/preview_token/` | 🔴 |
| 30 | Concierge / "edit with AI" | Always-on dock chat with `agent-concierge` that drives UI (`focus_*`) + secrets (`set_secret`) + staged authoring; seed prompts from inline buttons | ingress + client tools | 🔴 (transport ready; see M-Concierge) |

> **Out of scope (owned elsewhere):** billing (AI-gateway wallet + ledger) and
> the registry (native tools / skill templates / custom tool templates).

## Milestones

### Done

- [x] **M1** — IA scaffold: feature dir, routes, surfaced under `/code/agents`.
- [x] **M2** — read surface: shared types, `PostHogAPIClient` methods (apps /
  sessions / approvals / revisions / fleet), query hooks, list + per-agent
  detail views.
- [x] **M3** — SSE→ACP chat adapter:
  - [x] M3a — typed `AgentSessionEvent` SSE union + transcript content types.
  - [x] M3b — pure mappers (stored transcript + live SSE) → `AcpMessage[]`,
    18 unit tests.
  - [x] M3c — stored session transcripts render through `ConversationView`.
- [x] **Tabs** — split Agents into Scouts + Applications tabs.

### Done this session

- [x] **M4 — Sessions & logs** (features 5, 7, 8) — filterable session list,
  session-detail KPI strip + "fired by" cron badge, structured Logs pane.
  Commit `0f15929f` (incl. the latent empty-conversation render fix).
- [x] **M5 — Approvals** (features 9, 11) — per-agent approvals queue, decide
  (approve/reject + edited args + reason). Commit `a2fa9115`, then reworked into
  **master/detail with embedded session + refresh controls** (`a376b61b`).
  Remaining: the fleet-wide global approvals queue (feature 10).
- [x] **M7 — Observability** (features 25, 26; also 1, 3) — agent observability
  over the team's own `$ai_*` events via a `getAgentAnalytics()` HogQL rollup on
  `PostHogAPIClient` (5 parallel `/query/` panels, pure unit-tested shaping in
  `agent-analytics.ts`). Surfaced as: the **Applications overview** (KPI strip —
  spend/sessions/failure/p95 with 14-day sparkline trends + WoW deltas — blended
  on top of the agent list, with per-agent rollups merged into each row); the
  per-agent **Overview** tab (same KPI strip + link to the Observability tab);
  and a new per-agent **Observability** tab (KPIs + cost-by-model + tool
  reliability). Each surface has a small "Open in AI observability" deep link.
  Data layer committed in `aed89291`; UI in `0856ea5f`. **Design note:** there is
  no separate fleet-analytics page — analytics is blended into the overview and
  the per-agent tabs. This replaced the old operational fleet/agent stat strips
  (live-now + pending-approvals counts) — those return with M6 / feature 10.
- [x] **Configuration explorer** (features 12, 13, 14, 17, 18, 23 + M8/M9) —
  full-bleed filesystem explorer on a reusable `FileExplorer` primitive: a tree
  (instructions · model · triggers · secrets · skills · tools · mcps ·
  integrations · limits) + per-node detail panes + bundle viewer
  (markdown/code/json), selection in `?node=`. Stage A shell `1e5c1b91`; Stage B
  trigger richness — auth modes/blurbs, public warning, **Slack setup card**,
  trigger endpoints + curl/MCP usage, **cron "Run now"**, missing-secret
  warnings, MCP tools grid — `aed89291`; **M9 revision bar** (picker drives the
  explorer via `?revision=` + freeze/promote/archive behind confirms) `55dbb1b8`.
- [x] **M10 — Secrets** (feature 19) — set/rotate/**guarded clear** inline in the
  secret detail (`env_keys` PUT/DELETE), status flips across the tree on success;
  a set secret hides its input behind Rotate and Clear is a two-step confirm.
  Commit `32e8749d`.
- [x] **M11 — Memory** (features 20, 21, 22) — Memory tab on the reusable
  `FileExplorer`: folder tree + read file (markdown, with description/tags), a
  Files/Tables toggle, BM25 search mode, and a tables view (list + row grid).
  Render-only; create/update/delete deferred. Commit `22caee62`.
- [x] **M-Live (chat preview)** (feature 27) — per-agent **Chat** tab that runs a
  live session against the agent's ingress and renders it through the native
  `ConversationView`. **This resolved the M-Live "where does cloud-SSE transport
  live" open question:** transport is a renderer-scoped UI hook (`useAgentChat`)
  driving `run/send/cancel` + the `/listen` SSE loop via the api-client, mapped
  to `AcpMessage[]` (`createAgentChatMapper`) into a new core `agentChatStore`;
  no main-process/tRPC seam needed. Ingress is **region-derived**
  (`resolveIngressBaseUrl`: dev → `localhost:3030` because the dev trycloudflare
  tunnel buffers SSE; us/eu use `ingress_base_url`). QoL: `ConversationView` got
  an optional `collapseMode` override (preview passes `"none"` so prose isn't
  folded into a tool-call chip); the user message renders optimistically on send
  (echo deduped); an info banner names the deployed revision; a local
  recent-chats rail lists only chats started **here** (persisted per agent — not
  the server session list), with new-chat + resume that rebuilds the transcript
  from the stored session detail (`/listen` only tails, never replays) and
  re-attaches the live stream for active sessions. Client tools: `toast` /
  `get_context` resolve inline; `focus_*` / `set_secret` degrade to
  `unhandled_client_tool` (wired by M-Concierge). Commit `c0688cfa`.

### Remaining (parity work)

Reframed around the **render-first / concierge-authoring** principle above:
config/revisions/secrets/memory are read surfaces with only operational
controls. Ordered by core value.

- [ ] **Enable / disable agent** — archive/unarchive the application (an
  operational control deferred from M9; needs the destroy/restore endpoint).
- [ ] ~~**M12 — Spec & bundle authoring**~~ — **retired.** Spec/bundle/trigger
  editing is the concierge's job; the render views live in M8, operational
  lifecycle in M9.

### Deferred

- [ ] **M13 — Connections** (feature 24) — **deferred** (legacy idea). A separate
  integrations view isn't needed right now: Slack setup (feature 23) already
  ships under the slack trigger, and `spec.integrations` renders in the config
  explorer.
- [ ] **Global approvals queue** (feature 10) — fleet-wide approval inbox at the
  Applications level (the per-agent queue shipped in M5). Client method
  `listAgentFleetApprovals` already exists; needs UI. Pairs with M6 (it also
  restores the "pending approvals" signal the M7 overview dropped).

- [ ] **M6 — Live-now & operational counts** (feature 2; remainder of 1) —
  partly **realized by M7**: the Applications landing is now the observability
  entrypoint (analytics KPIs blended with the agent list), so the stat-strip
  ask is met by analytics. What's left is the **live-now panel** (cross-agent
  in-flight sessions, `agent_fleet/live_sessions/` — `listAgentFleetLiveSessions`
  client method exists) and re-surfacing the **operational counts** (live now +
  pending approvals) that the analytics KPIs displaced. Pairs well with the
  global approvals queue (feature 10).
- [ ] **M-Live (remainder)** (features 28, 29) — the live transport itself shipped
  (see "Done this session"); the **open transport question is resolved**
  (renderer-hook + region-derived ingress). What's left on the live track:
  - [ ] **In-chat approvals** (feature 28) — when a live turn proposes an
    approval-gated tool call, surface the decision inline in the chat (reuse the
    M5 decide path) instead of only in the Approvals tab.
  - [ ] **Draft preview** (feature 29) — run a non-live **draft** revision live
    before promoting, via the preview-proxy / short-lived `preview_token`
    (`AgentChat` in the console mints/refreshes it on `preview_token_required`).
    Lets the concierge "test before promote".
- [ ] **M-Concierge** (feature 30) — an always-on **right-hand dock** chat with
  the deployed `agent-concierge` (LIVE) that drives the whole `/code/agents`
  surface: inspect/debug agents, and author/edit them via consent-gated **staged
  draft revisions** (the agent does the spec edits server-side through its
  `@posthog/agent-applications-*` management tools; code renders the chat, drives
  the UI, and handles secrets). **Decisions:** global dock across all of
  `/code/agents` (not whole-app); fixed `agent-concierge` slug (confirmed
  deployed); reuses the shipped live-chat stack (`useAgentChat` / `agentChatStore`
  / mapper / `ConversationView` / region-derived ingress). Staged:
  - [ ] **C1 — Dock shell.** Global resizable right rail in the `/code/agents`
    layout (react-resizable-panels + `autoSaveId` like `FileExplorer`; toggle +
    keyboard shortcut; open/width persisted in a UI view-state store) hosting a
    concierge `ChatSurface` pointed at `agent-concierge`. **Generalize
    `agentChatStore`** to hold two concurrent chats (concierge dock + per-agent
    preview) — the store already notes it should key by a chat id; do that here.
  - [ ] **C2 — Page-context registry.** A `useSetConciergePage(ctx)` hook each
    agents route calls on mount to register what's shown (`agent-list` / `agent`
    / `agent-config` {view,item} / `agent-sessions` / `agent-session` …), kept in
    a context store. The transport prepends a `[console-context]{…}[/console-context]`
    envelope to the **first** message and a `get_context` client tool returns it
    live (extend the existing minimal `get_context`).
  - [ ] **C3 — `focus_*` UI-driving tools.** Implement `focus_tab`, `focus_file`,
    `focus_revision`, `focus_spec_section`, `focus_session` as TanStack-router
    navigations (agent tab + `?node=` / `?revision=` / `?request=` / session) plus
    a refetch, gated by a **follow-mode** toggle (returns `{focused:false,
    reason:'user_paused_follow'}` when off). Finish wiring `toast` → Sonner.
  - [ ] **C4 — `set_secret` punch-out.** The interactive client tool: render an
    inline secret form (reuse `SecretEditor`) next to the tool call; on submit
    `PUT env_keys` and post the outcome via `sendAgentClientToolResult`; the
    session parks and resumes on a fresh turn. Raw value never reaches the agent.
    (Replaces the current `unhandled_client_tool` degradation.)
  - [ ] **C5 — "Edit with AI" seeds.** Inline buttons across the render surfaces
    (agent overview, a config node, a failing session) that open the dock and
    seed a prompt + agent slug; if a chat is active, a "start fresh / continue"
    confirm (the console's `ConciergeSeedDialog`).
  - [ ] **Message-format deep dive (optional).** The acute issue — assistant prose
    hidden inside a collapsed tool-call chip — is fixed via the `collapseMode`
    override. A deeper side-by-side audit of our pi-ai conversation/part shape
    vs. what `buildConversationItems` expects (turn bracketing, content-block
    shapes) could still tighten `chat/conversationToAcp.ts` + `acpEnvelope.ts`
    for pixel-faithful rendering; the concierge exercises the same path live.

## What's demoable today (M1–M3 + tabs)

Requires the app authenticated against a PostHog backend that has the
`agent_platform` app deployed (i.e. the `ass` branch). Against production Cloud
the data endpoints 404, so the data surfaces show error/empty states — the UI
shell, tabs, and navigation still work.

With a backend that has deployed agents + sessions:

- `/code/agents` → **Scouts / Applications tabs**.
- **Applications tab**: observability KPIs (spend / sessions / failure rate /
  p95 with 14-day sparkline trends + WoW deltas) blended on top of the agent
  list, with per-agent rollups on each row.
- **Per-agent detail**: **Overview** (observability KPIs + recent sessions) and
  an **Observability** tab (KPIs + cost-by-model + tool reliability), each with
  an "Open in AI observability" deep link.
- **Session transcript**: a stored session rendered read-only through code's
  native chat UI (streaming text, thinking, tool calls + results).
- **Chat preview** (chat-trigger agents): the per-agent **Chat** tab runs a live
  session against the agent's ingress — send/cancel, optimistic echo, a
  recent-chats rail with resume. (Try it against `agent-approval-demo`.)

Not yet built: everything in the parity map still marked 🟡 / ⬜ / 🔴 — the
global approvals queue, live-now panel, in-chat approvals, draft preview, and
the **concierge dock** (M-Concierge). Authoring stays the concierge's job.
