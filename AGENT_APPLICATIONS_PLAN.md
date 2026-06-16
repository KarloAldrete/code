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

### Remaining (parity work)

Ordered roughly by leverage: the browsing/monitoring + approvals tracks are
mostly "wire up UI to existing client methods", so they land first and are
demoable against an `ass` backend without the live-SSE transport. Authoring and
live chat come after.

- [ ] **M4 — Sessions & logs** (features 5, 7, 8) — filterable session list,
  session-detail KPI strip + "fired by" cron badge, and the **structured Logs
  pane** (the big missing read surface). Add `…/sessions/{id}/logs/` to the
  client + a `LogEntry` type.
- [ ] **M5 — Approvals** (features 9, 10, 11) — per-agent + global approvals
  queue, detail with reasoning snapshot + proposed args, approve/reject with
  optional edited args + reason. Client methods exist; `decide` is a mutation →
  put it (and optimistic refresh) behind a core service method. Distinct from
  in-chat ACP approvals (M-Live).
- [ ] **M6 — Fleet overview & live-now** (features 1, 2) — stat strip + live-now
  panel + recent activity on the Applications landing page; wire agent-list
  filters + per-agent inline stats (feature 3).
- [ ] **M7 — Observability** (features 25, 26) — per-agent observability
  **summary page** and the fleet analytics dashboard, both via `/query/` HogQL
  over the team's `$ai_*` events. Pure reads through `PostHogAPIClient`.
- [ ] **M8 — Configuration & spec explorer (read)** (features 12, 13) —
  read-only spec explorer + bundle file viewer + manifest tree. No writes yet.
- [ ] **M9 — Revisions & lifecycle** (feature 14) — revision list +
  freeze/promote/archive/rollback + clone/new_draft. Lifecycle is a core service
  (promote rewrites `live_revision`).
- [ ] **M10 — Secrets/env** (feature 19) — env-key management UI + required-
  secret discovery from spec. Writes via core service (encrypted at rest).
- [ ] **M11 — Memory** (features 20, 21, 22) — file store CRUD + BM25 search +
  tables viewer. Greenfield: types + client + UI.
- [ ] **M12 — Spec & bundle authoring** (features 15, 16, 17) — edit spec on a
  draft, validate, render system prompt, write/delete bundle files, trigger
  config editors.
- [ ] **M13 — Connections** (features 23, 24) — Slack setup card + integrations.
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
