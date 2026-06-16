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
| 1 | Fleet overview / stat strip | Aggregate KPIs across all agents | `agent_fleet/stats/` | 🟡 |
| 2 | Live-now panel | Cross-agent in-flight sessions, live state dots | `agent_fleet/live_sessions/` | 🟡 |
| 3 | Agent list + filters | All agents, per-agent inline stats, All/Live/Drafts/Archived | `agent_applications/`, `…/stats/` | ✅ list / 🟡 filters+stats |
| 4 | Per-agent overview | Status, triggers, live revision, recent activity | `agent_applications/{slug}/` | ✅ |
| 5 | Session list + filters | History; filter by state / revision / date; pagination | `…/sessions/?state=&revision_id=&…` | 🟡 |
| 6 | Session transcript | Stored transcript via native `ConversationView` | (mapper) | ✅ |
| 7 | Session KPI strip + "fired by" | Per-session state/tools/cost/duration/errors; cron badge | (in session detail) | ⬜ |
| 8 | **Session logs pane** | Structured pino-style log viewer, level/service filters, expandable fields | `…/sessions/{id}/logs/` | ⬜ |
| **Approvals** ||||
| 9 | Per-agent approvals queue | List approval-gated tool calls, filter by state | `…/approvals/` | 🟡 |
| 10 | Global approvals queue | Fleet-wide approval inbox | `agent_fleet/approvals/` | 🟡 |
| 11 | Approval detail + decide | Reasoning snapshot, proposed args, approve/reject + edit args + reason | `…/approvals/{id}/decide/` | 🟡 (client) / ⬜ (UI) |
| **Configuration & authoring** ||||
| 12 | Spec explorer | Filesystem-style view of model/triggers/tools/skills/mcps/integrations/limits | revision `spec` JSONB | ⬜ |
| 13 | Bundle file viewer | Manifest tree + read file, language-aware render | `…/revisions/{id}/manifest/`, `/file/` | ⬜ |
| 14 | Revision list + lifecycle | draft → freeze(ready) → promote(live) → archive; rollback; clone / new_draft | `…/revisions/`, `/freeze/`, `/promote/`, `/archive/`, `/clone_from/`, `/new_draft/` | 🟡 (read) / ⬜ (lifecycle) |
| 15 | Spec editing + validate | Edit spec on a draft, validate against schema, render system prompt | `…/revisions/{id}/` PATCH, `/validate/`, `/system_prompt/` | ⬜ |
| 16 | Bundle file editing | Write/delete files, bulk bundle upload (draft only) | `…/revisions/{id}/file/` PUT/DELETE, `/bundle/` | ⬜ |
| 17 | Trigger config | chat / webhook / mcp / slack / cron triggers + auth modes | revision `spec` | ⬜ |
| 18 | Cron fire (run-now) | Manually fire a cron out-of-band to test | `…/revisions/{id}/cron_fire/` | ⬜ |
| **Secrets & env** ||||
| 19 | Env / secrets management | List keys, set/rotate/clear per key, bulk set_env, discover required secrets from spec | `…/set_env/`, `…/env_keys/…` | ⬜ |
| **Memory** ||||
| 20 | Memory file store | List / tree / read / create / update / delete files | `…/memory/files/`, `/tree/`, `/by_path/` | ⬜ |
| 21 | Memory search | BM25 full-text search | `…/memory/search/?q=` | ⬜ |
| 22 | Memory tables | List tables + read rows | `…/memory/tables/…` | ⬜ |
| **Connections** ||||
| 23 | Slack setup | Generate Slack app manifest from trigger+tool config | `…/revisions/{id}/manifest/slack/` | ⬜ |
| 24 | Integrations | PostHog integrations attached to an agent | (spec `integrations` + integ API) | ⬜ |
| **Observability & analytics** ||||
| 25 | Per-agent observability summary | Rollup page: spend, sessions, failure rate, p95, tokens for this agent | `/query/` HogQL `$ai_*` | ⬜ |
| 26 | Fleet analytics dashboard | Cross-agent KPIs + WoW deltas, spend-by-agent, cost-by-model, tool reliability | `/query/` HogQL `$ai_*` | ⬜ |
| **Live & interactive** ||||
| 27 | Live chat / streaming | SSE transport → ACP; send message; client tools; cancel | ingress `/agents/{slug}/run\|send\|listen\|cancel` | 🔴 |
| 28 | In-chat approvals | ACP tool-call permission prompts during a live turn | ingress + approvals | 🔴 |
| 29 | Draft preview | Run a non-live draft revision live before promoting | `…/preview-proxy/…`, `/preview_token/` | 🔴 |
| 30 | Concierge / "edit with AI" | An agent that drives config/UI edits; seed prompts from inline buttons | ingress + MCP | 🔴 |

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

### Remaining (parity work)

Reframed around the **render-first / concierge-authoring** principle above:
config/revisions/secrets/memory are read surfaces with only operational
controls. Ordered by core value.

- [ ] **M8 — Configuration & spec explorer (read)** (features 12, 13) —
  Configuration tab rendering the live (or selected) revision's spec: model,
  triggers, tools, skills, mcps, integrations, limits, entrypoint, reasoning.
  Pure read off the existing `getAgentRevision` (`spec` JSONB) — no new
  endpoints. Bundle file viewer + manifest tree (feature 13) is a follow-on
  (needs `…/revisions/{id}/manifest/` + `/file/`). **No spec editing.**
- [ ] **M9 — Revisions & operational lifecycle** (feature 14, scoped) — revision
  list with states/lineage + the **operational** actions only: promote (incl.
  rollback to an older revision), freeze (draft→ready), archive. Plus **enable /
  disable agent** (archive/unarchive the application). These mutations go behind
  a core service (promote rewrites `live_revision`). Draft authoring
  (clone/new_draft, spec edits) is **out** — the concierge does that.
- [ ] **M10 — Secrets/env (read)** (feature 19, scoped) — show which env keys
  are set (names only, never values) + which secrets the spec requires. Whether
  setting/rotating a secret value belongs here or is also concierge-driven is an
  open question (a real API key can't be handed to the concierge in chat) —
  resolve before building any write path.
- [ ] **M11 — Memory** (features 20, 21, 22) — file store + BM25 search + tables.
  Render-first; if any write lands it's operational, not authoring.
- [ ] **M13 — Connections** (features 23, 24) — Slack setup + integrations view.
- [ ] **M7 — Observability** (features 25, 26) — per-agent observability
  **summary page** + fleet analytics, via `/query/` HogQL over the team's
  `$ai_*` events. Likely becomes the **Applications landing entrypoint** (see
  deferred M6). Pure reads through `PostHogAPIClient`.
- [ ] **Global approvals queue** (feature 10) — fleet-wide approval inbox at the
  Applications level (the per-agent queue shipped in M5).
- [ ] ~~**M12 — Spec & bundle authoring**~~ — **retired.** Spec/bundle/trigger
  editing is the concierge's job; the render views live in M8, operational
  lifecycle in M9.

### Deferred

- [ ] **M6 — Fleet overview & live-now** (features 1, 2, 3) — **deferred.** The
  Applications landing is likely to become an **observability entrypoint** (M7)
  rather than a stat-strip + live-now dashboard. Revisit after M7.
- [ ] **M-Live — Live chat & interactivity** (features 18, 27, 28, 29) — the
  SSE transport (EventSource against agent-ingress), send a message, client
  tools, cancel, in-chat approvals (ACP tool-call permissions), cron-fire, and
  draft preview. `createAgentChatMapper()` is built + tested; this wires it to
  the live stream. **Open question (unchanged):** where the cloud-SSE transport
  lives in code's layered model — no existing precedent. The console used a
  browser `EventSource` against a Next.js proxy that injected the OAuth bearer;
  code has no such proxy seam yet. This is the gating design decision for the
  entire live track.
- [ ] **M-Concierge** (feature 30) — the concierge ("edit with AI") that drives
  config edits, plus the inline seed buttons. Builds on M-Live + the authoring
  mutations (M9–M12). Optional standalone deployed-agent chat package.
  - [ ] **Message-format deep dive.** The stored transcript renders through
    code's native `ConversationView` (via the SSE→ACP mapper), but it currently
    reads *a little weird* in places — our agent_platform conversation/part
    shape (pi-ai `text`/`thinking`/`toolCall` + `toolResult` messages) doesn't
    map 1:1 onto what `ConversationView` / `buildConversationItems` expects (ACP
    `agent_message_chunk` / `tool_call` / `tool_call_update`, turn bracketing,
    content-block shapes). Audit the two formats side by side and tighten the
    mapper (`chat/conversationToAcp.ts` + `acpEnvelope.ts`) so deployed-agent
    chat renders pixel-faithfully to a local session. Fits naturally with the
    concierge work, which exercises the same rendering path live.

## What's demoable today (M1–M3 + tabs)

Requires the app authenticated against a PostHog backend that has the
`agent_platform` app deployed (i.e. the `ass` branch). Against production Cloud
the data endpoints 404, so the data surfaces show error/empty states — the UI
shell, tabs, and navigation still work.

With a backend that has deployed agents + sessions:

- `/code/agents` → **Scouts / Applications tabs**.
- **Applications tab**: fleet stat strip + the list of deployed agents.
- **Per-agent detail**: overview stat strip + recent sessions list.
- **Session transcript**: a stored session rendered read-only through code's
  native chat UI (streaming text, thinking, tool calls + results).

Not yet built: everything in the parity map marked 🟡 / ⬜ / 🔴 — session logs,
approvals UI, live-now, observability, configuration/spec, revisions, secrets,
memory, connections, and the entire live/interactive track. The transcript view
is read-only playback.
