# Hedgemony — User Stories (Vertical Slices)

How we ship Hedgemony in vertical, demoable slices. Each slice cuts top-to-bottom (migration → main service → tRPC → store → map UI) and ends in an operator-facing moment you can show off. Companion docs: [spec.md](./spec.md), [backend-integration.md](./backend-integration.md), [backend-frontend.md](./backend-frontend.md).

---

## Slicing principles

- **Every slice ships a demoable operator action.** "Operator does X, sees Y." No infra-only slices.
- **Each slice writes one new table (or column path)** plus the matching service / router / store / UI.
- **Risk-buying slices come after their cheaper neighbors.** Embeddings, the agent harness, and the PR DAG wait until plain CRUD has shaken out the boundary.
- **The hedgehog is decomposed, not one slice.** Brood mgmt → feedback routing → PR graph → goal judgment ship separately so autonomy can be flag-gated progressively.
- **Hedgemony is a Command Center view mode**, not a sidebar entry. Every slice's UI lands inside Command Center's view switcher.

---

## Slice 0 — Empty stadium

**As an operator,** I want to flip on Hedgemony in Command Center and see an empty map view, so I know the feature exists and the chassis works end to end.

**In scope**
- Migration creates all 5 `hedgemony_*` tables (idempotent, runs even when flag off).
- DI container constructs Hedgemony services only when `hedgemonyEnabled`.
- Empty `hedgemony` tRPC router registered behind the flag.
- New `features/hedgemony/` folder + Command Center view-mode option.
- Pan/zoom canvas with an empty-state.

**Out of scope**
- Any nest, hoglet, or signal logic.

**Acceptance criteria**
- Toggling `hedgemonyEnabled` shows/hides the Command Center view-mode option.
- Tables exist in sqlite whether or not the flag is on.
- No new code runs in the hot path when the flag is off.

**Demo moment**
- Flip the flag → switch Command Center to Hedgemony view → see empty map.

**Why first** — locks in boundary discipline (the mandatory import rule from backend-integration.md) before any feature pressure arrives.

---

## Slice 1 — Place a nest (CRUD only, no hedgehog)

**As an operator,** I want to drop a nest on the map with a freeform goal prompt, so I can declare an objective I'll later staff with agents.

**In scope**
- `hedgemony_nest` writes only.
- `NestService.create / list / archive / update`; matching repository.
- tRPC: `nests.create`, `nests.list`, `nests.archive`, `nests.update`, `nests.watch` subscription.
- `nestStore` driven by `list` + `watch`.
- Nest sprite component, "place nest" modal capturing name + `goal_prompt` + click coords.

**Out of scope**
- No hedgehog orchestrator spawn (deferred to Slice 6).
- No loadout fields beyond name + prompt (deferred to Slice 10).

**Acceptance criteria**
- Place 3 nests at distinct coords → all persist across app restart.
- Archive flips status without dropping the row.

**Demo moment**
- Place 3 nests, restart app, confirm they reappear where you put them.

---

## Slice 2 — Spawn an ad-hoc wild hoglet

**As an operator,** I want to spawn a one-off agent without picking a nest, so I can dispatch unstructured work and still see it in Hedgemony.

**In scope**
- `hedgemony_hoglet` writes with `nest_id = null`, `signal_report_id = null`.
- `HogletService.spawnAdhoc` reuses the existing `task-creation.ts` saga, then inserts the sidecar row.
- tRPC: `hoglets.spawnAdhoc`, `hoglets.list({ wildOnly: true })`, `hoglets.watch`.
- `hogletStore` with a special `wild` key.
- Holding-area drawer + wild hoglet card with live Task status.

**Out of scope**
- No adoption into a nest yet.
- No signal-driven spawn yet.

**Acceptance criteria**
- Spawning produces a Task + a hoglet sidecar row in one transaction.
- Wild card reflects underlying Task state via existing primitives (`not_started → in_progress → completed/failed`) and PR badge from `getTaskPrStatus`.

**Demo moment**
- Spawn ad-hoc → wild card appears → status updates as the Task runs → PR opens → card shows "open PR" badge.

**Why now** — proves the Task ↔ hoglet sidecar pattern with zero hedgehog complexity.

---

## Slice 3 — Adopt a wild hoglet into a nest

**As an operator,** I want to drag a wild hoglet onto a nest, so I can manually organize agents around an objective.

**In scope**
- `UPDATE hedgemony_hoglet SET nest_id = ?`.
- tRPC: `hoglets.adopt`, `hoglets.release`, `hoglets.list({ nestId })`.
- Drag-drop from drawer onto nest sprite.
- Nest renders its brood positioned around it.

**Out of scope**
- Hedgehog autonomy still doesn't exist — operator drives all routing.

**Acceptance criteria**
- Adopting moves the hoglet's sprite from the drawer to the target nest.
- Release moves it back to the drawer.
- Persists across restart.

**Demo moment**
- Spawn 3 wild hoglets → adopt 2 into nest A, 1 into nest B → see clustering. Restart → state preserved.

---

## Slice 4 — Signals become wild hoglets

**As an operator,** I want PostHog signal reports to arrive in Hedgemony as wild hoglets, so I can triage and adopt them visually instead of from the Inbox.

**In scope**
- `EventSourceService` poll tick: `PosthogAPIClient.getSignalReports`, dedupe via `hedgemony_hoglet.signal_report_id` index.
- Initial prompt built from `title + summary + findings + suggested_reviewers`.
- Wild hoglet card shows signal-report origin (link + summary line).

**Out of scope**
- No auto-routing — every signal lands wild for now.
- No hedgehog handling — manual adoption still required.

**Acceptance criteria**
- Same `signal_report_id` never spawns two hoglets.
- Hedgemony's poll is independent of Inbox's autonomy (feature-flag toggling one doesn't move the other).

**Demo moment**
- Trigger a signal in PostHog → wild hoglet appears within the poll interval → adopt into the appropriate nest.

**Risk bought** — ingestion path, dedupe, initial-prompt shape.

---

## Slice 5 — Affinity router

**As an operator,** I want incoming signals to auto-route to the most relevant nest, so I stop hand-sorting things that obviously belong together.

**In scope**
- Embedding column on `hedgemony_nest` (cached on `goal_prompt` write).
- `AffinityRouter` called from `EventSourceService` before insert.
- Cosine similarity + threshold; sub-threshold falls through to wild.
- Tooltip on auto-routed hoglets showing similarity score; drag-reassign still works.

**Out of scope**
- LLM judge for borderline cases (v2).
- Learned routing from operator adoptions (v2).

**Acceptance criteria**
- Threshold is configurable (settings or env, not hard-coded).
- Operator override always wins — a manually adopted hoglet doesn't get re-routed.

**Demo moment**
- Nest "improve checkout conversion" + checkout-related signal → auto-bound. Unrelated signal → wild.

**Why here** — manual adoption (Slice 3) needs to work before the router can mis-route silently. Threshold tuning will iterate.

---

## Slice 6 — Hedgehog: brood management only

**As an operator,** I want a hedgehog per nest that proposes which idle hoglets to raise, so I can approve a batch instead of clicking start on every one.

**In scope**
- `hedgemony_hedgehog_state` rows; `hedgemony_hoglet.role = 'orchestrator'` for the hedgehog Task itself.
- `HedgehogService`: spawn orchestrator on nest create, tick on timer + event-bus, serialize state at end of each tick, resume from row on app start.
- Constrained agent harness with three tools: `propose_raise`, `raise_hoglet`, `kill_hoglet`.
- Operator-approval gate in front of `raise_hoglet` (toggle to auto in later iteration).
- Nest sprite glows when hedgehog is ticking; pending-raise toast with approve/deny.

**Out of scope**
- No feedback routing, no PR graph, no goal judgment.

**Acceptance criteria**
- Force-quit app mid-tick → reopen → hedgehog resumes cleanly from `serialized_state_json`.
- Hedgehog has no tools to commit code herself.

**Demo moment**
- Nest with 3 idle hoglets → hedgehog proposes raise → operator approves → tasks start in parallel.

**Risk bought** — biggest concept in the feature. Keep it minimum-viable; the approval gate is the safety net.

---

## Slice 7 — Feedback routing (PR review + CI)

**As an operator,** I want PR review comments and CI failures to land back on the originating hoglet automatically, so I don't have to click "Fix with agent" myself.

**In scope**
- `hedgemony_feedback_event` writes (dedupes routing).
- `FeedbackRoutingService` polls `github-integration` + `git/service.ts: getTaskPrStatus`.
- Reuses existing `reviewPrompts.ts` builders.
- Calls `sendPromptToAgent` to inject the prompt into the hoglet's conversation.
- `feedback.watch(nestId)` subscription drives an activity feed on the nest panel.

**Out of scope**
- No upstream `pull_request_review` webhook (v2 graduation).
- No Slack relay (v2).

**Acceptance criteria**
- Same comment never routes twice (feedback-event log is the source of truth).
- Failure path: routing failure logs but doesn't crash the hedgehog tick.

**Demo moment**
- Leave a PR review comment → message lands in the hoglet's task automatically → fix commit appears.

**Why now** — highest-leverage autonomy moment. Most of the mechanism exists upstream; this slice is mostly wiring.

---

## Slice 8 — PR dependency graph + auto-rebase

**As an operator,** I want stacked hoglet PRs to rebase automatically when their parent merges, so I'm not manually unblocking a chain every time something lands.

**In scope**
- `hedgemony_pr_dependency` edges with `pending → satisfied → broken` state machine.
- `PrGraphService`; new hedgehog tools `link_pr_dependency`, `unlink_pr_dependency`, `rebase_child`.
- Rebases run through the existing `worktree-manager`.
- Conflict path: failed rebase routes a "resolve and continue" prompt back to the child hoglet.
- Map UI: arrows between hoglet sprites; edge color tracks state.

**Out of scope**
- Hedgehog autonomously resolving conflicts (stays with the hoglet).

**Acceptance criteria**
- Parent merge → child rebases without operator action.
- Conflict → child receives a routed prompt; edge state goes `broken` until resolved.

**Demo moment**
- Nest with PR B depending on PR A → merge A → B auto-rebases on master+A.

---

## Slice 9 — Goal judgment + propose completion

**As an operator,** I want the hedgehog to tell me when she thinks a nest's goal is satisfied, so closing nests doesn't become my job to remember.

**In scope**
- `propose_completion` agent tool.
- LLM judge call over `goal_prompt` + merged PRs in `hedgemony_pr_dependency` + resolved signal reports.
- Returns `not_satisfied | likely_satisfied | definitely_satisfied`.
- Operator-confirmation modal showing the summary + PR list.
- Confirmed close transitions nest to dormant; hibernacula preserved.

**Out of scope**
- Auto-close above a confidence threshold (v2).
- Live metric watching via PostHog MCP (deferred; optional `target_metric_id` lands in Slice 10).

**Acceptance criteria**
- Operator confirmation is always required.
- Dormant nest's hoglets and PRs remain queryable.

**Demo moment**
- Nest with 3 merged PRs touching checkout → hedgehog proposes close with summary → operator confirms → nest goes dormant.

---

## Slice 10 — Prickle + loadout editor (polish)

**As an operator,** I want to select multiple hoglets at once and edit a nest's loadout, so power-user flows feel like an RTS instead of a form.

**In scope**
- `selectionStore`: drag-select box, ctrl+click toggle, ctrl+1/2/3 group bind + recall.
- Group ops bar: dispatch, adopt, kill, batched custom prompt.
- `loadoutDraftStore`: optimistic edits to skills / MCPs / docs / optional `target_metric_id`.
- `nests.update` accepts full `loadout_json`; subsequent hedgehog spawns pick it up.
- Settings-style panel on each nest.

**Out of scope**
- Per-hoglet loadout customization at spawn time (operator can still send custom prompts via the existing Task UI).

**Acceptance criteria**
- Selection is never persisted (purely client-side).
- Loadout edits apply to the next spawn, not retroactively to running hoglets.

**Demo moment**
- Drag-select 4 hoglets, send a batched prompt; edit nest loadout, watch the next spawn pick it up.

**Why last** — none of the autonomy slices need it. It's the quality-of-life layer that sells once the substrate works.

---

## Checkpoints

- **After Slice 3** — first internal demo. Map "feels alive" with manual ops only. Cheap validation of whether the spatial metaphor lands before building the hedgehog.
- **After Slice 5** — affinity router open-beta to a handful of operators. Tune threshold.
- **After Slice 7** — public flag-flip candidate. Feedback routing is the moment Hedgemony delivers obvious value over plain Inbox.
- **After Slice 9** — v1 ship. Slice 10 is polish for v1.1.

The open product questions in `spec.md` (nest placement auto vs manual, idle hoglet TTL, render budget, Inbox vs Hedgemony default) map to specific slices — don't try to answer them up front; let them surface where they bite. Manual placement in Slice 1, idle TTL in Slice 6, render budget when hoglet counts get embarrassing.
