# Hedgemony — Backend ↔ Frontend

How Hedgemony's main-process backend exposes itself to the renderer. Companion doc: [backend-integration.md](./backend-integration.md). Product spec: [spec.md](./spec.md).

Assumes the data model and services from the backend-integration doc.

---

## View placement

A new top-level view, sibling to Inbox and Command Center. Reached from the main sidebar (`apps/code/src/renderer/features/sidebar/components/SidebarMenu.tsx`). Feature-flagged — the route is registered only when `hedgemonyEnabled`.

Folder: `apps/code/src/renderer/features/hedgemony/`, matching the existing feature-folder convention (`features/inbox`, `features/command-center`, `features/code-review`, etc.).

---

## tRPC routers + subscriptions

One new router: `apps/code/src/main/trpc/routers/hedgemony.ts`. Mirrors the shape of existing routers (`inbox.ts`, `workspace.ts`, etc.).

**Queries:**
- `nests.list()` → all active nests + their hoglet counts + status.
- `nests.get(id)` → full nest with loadout, hedgehog state summary, hoglet roster, PR dep graph, recent feedback events.
- `nests.create(input)` → returns nest + spawned hedgehog task.
- `nests.update(id, patch)` → goal prompt, loadout, map position.
- `nests.archive(id)` / `nests.unarchive(id)`.
- `hoglets.list({ nestId?, wildOnly? })` → joined with `tasks` for status.
- `hoglets.adopt(hogletId, nestId)` / `hoglets.release(hogletId)`.
- `hoglets.spawnAdhoc({ prompt, repo? })` → wild hoglet from operator.

**Mutations**: covered above (`create`, `update`, `archive`, `adopt`, etc.). All Hedgemony writes go through the router — renderer never touches the sqlite repositories directly.

**Subscriptions** (tRPC observables backed by an event bus in the Hedgemony main services):
- `nests.watch(id)` → emits on nest status change, hoglet roster change, hedgehog tick.
- `hoglets.watch(nestId)` → emits on hoglet status change.
- `feedback.watch(nestId)` → emits each routed feedback event for the activity feed.

Renderer connects subscriptions for the active view only; closes them on view exit.

---

## Zustand stores

Mirrors the Command Center pattern (`apps/code/src/renderer/features/command-center/stores/`). One feature, several small stores:

| Store | Holds |
|---|---|
| `nestStore` | List of nests, fetch/refresh state, map placements. Driven by `nests.list` + `nests.watch`. |
| `hogletStore` | Hoglet roster keyed by `nestId` (plus a special `wild` key). Driven by `hoglets.list` + `hoglets.watch`. |
| `selectionStore` | The current prickle — ephemeral set of selected hoglet IDs, plus hotkey group bindings (`ctrl+1/2/3`). Pure client state. |
| `hedgemonyViewStore` | UI state: zoom, pan offset, active panel, holding-area open/closed. Pure client state. |
| `loadoutDraftStore` | Optimistic edits to a nest's loadout before save. |

All Hedgemony stores live under `features/hedgemony/stores/`. None of them are shared with non-Hedgemony features.

---

## Map rendering — DOM vs canvas

The active design decision. Two options:

**A. DOM-based** (recommended for v1):
- Nests, hoglets, and the holding area are absolutely-positioned React components.
- Animations via Framer Motion or CSS transitions.
- Pros: composability with existing Radix UI, easy hit-testing, free accessibility tree, hot-reload friendly.
- Cons: render budget degrades past ~50–100 hoglets simultaneously.

**B. Canvas-based** (`react-konva` or `pixi-react`):
- Pros: scales to hundreds of units, smoother animations.
- Cons: extra dep, custom hit testing, accessibility story is bespoke, harder to reuse existing components.

V1 ships with A and a render-budget cap (e.g. clamp hoglet rendering to N visible). If we feel the ceiling, swap the canvas layer in behind the same store shape — stores stay DOM-agnostic.

---

## Selection model (prickle)

- **Drag-select**: pointer-down on empty map → draw selection box → all hoglets intersected go into `selectionStore.selected`.
- **Ctrl+click**: toggle individual.
- **Hotkey groups**: `Ctrl+1/2/3` binds current selection; `1/2/3` recalls.
- **Group ops** dispatched from selection: dispatch to nest, adopt to nest, kill, send custom prompt batched across hoglets.
- Selection is purely client-side — never persisted, never sent to main process.

---

## Loadout editor

Per-nest panel for editing the loadout — goal prompt, skills enabled, MCP servers, doc references, optional target metric. Mirrors the existing settings UI patterns (`features/settings/components/sections/`).

Edits live in `loadoutDraftStore` optimistically; "Save" flushes via `nests.update`. The loadout drives what gets passed to every hoglet the hedgehog spawns from that nest — there's no per-hoglet customization at spawn time (operator can still send custom prompts to individual hoglets via the existing task UI).

---

## Wild hoglet holding area

A persistent off-map UI region (left rail or bottom drawer, TBD) showing every hoglet with `nest_id = null`. Each row exposes:

- The signal report it came from (if any).
- "Adopt to nest" picker.
- "Spawn new nest around this" shortcut.
- "Dismiss" (marks the originating report `suppressed`).

Driven by `hoglets.list({ wildOnly: true })` + `hoglets.watch`.

---

## Hoglet visualization state

Visual state derives from posthog-code primitives, no Hedgemony-specific state needed:

| Hoglet visual | Source |
|---|---|
| Idle (not yet raised) | `Task.status = not_started` |
| Working | `TaskRun.status = in_progress` |
| Has open PR | `getTaskPrStatus → "open"` or `"draft"` |
| Blocked on review | open PR + unresolved review comments (from existing PR review polling) |
| Blocked on CI | open PR + `failed` CI status |
| Done | `TaskRun.status = completed` and PR merged |
| Failed | `TaskRun.status = failed` |

The hedgehog's status (active / sleeping / proposing completion) is its own orchestrator task's status plus a `hedgemony_hedgehog_state.last_tick_at` heartbeat.

---

## Telemetry

Reuse `apps/code/src/renderer/utils/analytics.ts`. New events under a `hedgemony.*` prefix:

- `hedgemony.nest_created`, `hedgemony.nest_archived`
- `hedgemony.hoglet_spawned` (with `source: signal | adhoc`)
- `hedgemony.hoglet_adopted`, `hedgemony.hoglet_dismissed`
- `hedgemony.hedgehog_raised_hoglet`, `hedgemony.hedgehog_proposed_completion`
- `hedgemony.feedback_routed` (with `source: pr_review | ci`)
- `hedgemony.pr_dependency_satisfied`, `hedgemony.pr_dependency_rebased`

Keep telemetry namespaced so it's trivially filterable and can be ripped out cleanly if Hedgemony is extracted.

---

## Open frontend decisions

1. **DOM vs canvas** — start DOM, measure, swap if needed.
2. **Holding-area placement** — left rail (persistent), bottom drawer (collapsible), or floating panel? Affects perceived priority of wild hoglets.
3. **Hedgehog as a visible unit** — does she render on the map next to her nest, or is she implicit (the nest itself glows when she's active)?
4. **Map persistence** — is `map_x` / `map_y` operator-placed (drag a nest where you want it) or auto-arranged (force-directed layout)? Open in spec.
5. **Cross-view linking** — clicking a hoglet should jump to the existing posthog-code task detail view; clicking back returns to the map with state preserved.
