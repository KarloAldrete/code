# REFACTOR.md — feature-by-feature migration guide

This file is the **procedure** for porting an existing feature into the new package architecture. Read [AGENTS.md](./AGENTS.md) for the layering rules. Read this when you're about to move a feature across.

[MIGRATION.md](./MIGRATION.md) is the running log of what landed and where — useful if you're tracking what's done vs. still to come.

---

## Target shape

Three packages carry the work, organized by runtime. Each one is domain-folder-structured inside.

```
packages/
├── core/                # pure JS. All domain logic. Runs anywhere.
│   ├── sessions/
│   ├── workspace/
│   ├── auth/
│   ├── tasks/
│   └── ...
├── ui/                  # React DOM. Mirrors core's domain folders.
│   ├── sessions/
│   ├── workspace/
│   ├── primitives/      # @posthog/quill wrappers, Button, Modal, Toast
│   └── ...
├── workspace-server/    # Node-only. Host syscalls. Organized by capability.
│   ├── git/
│   ├── fs/
│   ├── pty/
│   ├── process/
│   ├── watcher/
│   └── ...
│
├── platform/            # host-capability interfaces. Locked-down.
├── shared/              # zero-dep primitives, Saga, types. Locked-down.
├── workspace-client/    # TRPC client for workspace-server.
└── api-client/          # HTTP client for Django.

apps/
├── web/         # mounts packages/ui. Provides platform-web adapters.
├── desktop/     # Electron shell. Spawns workspace-server. Provides Electron
│                  platform-adapters. main = shell + adapters. NO business logic.
└── mobile/      # React Native. Imports core/* only. Writes its own RN UI.
```

Per-domain folder shape, by package:

```
core/sessions/                ui/sessions/                  workspace-server/git/
├── index.ts                  ├── index.ts                  ├── index.ts
├── service.ts                ├── SessionList.tsx           ├── procedures.ts
├── types.ts                  ├── SessionDetail.tsx         ├── git-ops.ts
└── service.test.ts           ├── useSession.ts             └── git-ops.test.ts
                              ├── store.ts        (Zustand)
                              └── SessionList.test.tsx
```

Flat. No `internal/` folder — `index.ts` is the boundary. Split into more files when a single file gets too long to read, grouped by concept.

**What each package owns:**

- **`core/<X>/`** — all business logic. Services, state machines, orchestration, retries, dedup, parsing, error normalization, typed events. Pure JS. Unit-testable with mocked clients.
- **`ui/<X>/`** — React components, hooks that wrap core service calls (`useQuery` over `core.sessions.list()`), and **thin** Zustand stores for pure UI state (selection, open/closed, scroll position, subscription-fed caches). **No business logic**, no multi-step flows, no retries, no orchestration, no `let inFlight: Promise` style dedup. If you find yourself writing those in `ui/`, the code belongs in `core/`.
- **`workspace-server/<cap>/`** — host syscall procedures (git CLI, fs read/write, spawn, watcher). Dumb. No decisions. Called by core through `workspace-client`.

The desktop **main process is not the home of business logic anymore.** It does three things: spawn workspace-server, mount renderer, implement platform adapters.

**Import rules** (biome `noRestrictedImports`):

- `core/<X>/` may import other `core/<Y>/` (via their `index.ts`), `shared/`, `platform/`, `workspace-client`, `api-client`. **Never** `ui/*` or `workspace-server/*`.
- `ui/<X>/` may import `core/*`, `ui/primitives/`, `shared/`. **Never** `workspace-server/*` or other `ui/<Y>/` internals.
- `workspace-server/<cap>/` may import `shared/`, Node modules, and other `workspace-server/<cap2>/` via `index.ts`. **Never** `core/*` or `ui/*` — workspace-server is the host; it knows nothing about business domains. Domains live in `core/` and *call into* workspace-server through `workspace-client`.
- `shared/` and `platform/` import nothing else internal.

---

## Ground rules

- **Don't guess. Flag.** When you can't decide where a piece of code belongs, leave `// TODO(refactor): <question>` and move on. Wrong placement is worse than an open question.
- **Preserve structure during the move.** Same function names, same parameter order, same control flow. The move should diff against the old file cleanly. *Refactoring the logic* happens after, not during.
- **Don't invent new layouts.** Don't create new sibling packages, new abstractions, or new naming conventions mid-move. If the existing structure doesn't fit, raise it — don't bend the move around it.
- **Delete, don't deprecate.** When code moves, the old file is removed in the same change. No shims, no re-exports, no "deprecated" comments.
- **Banned imports in `packages/core`.** No `electron`, no `node:fs`, no `node:child_process`, no `node:net`, no `node:os`, no `node:path`. Pure JS only. Anything you'd reach for there is either a workspace-server procedure or a `@posthog/platform` interface.
- **Don't bundle other work.** Wire-format changes, algorithm rewrites, new features, cosmetic renames — keep them out of the move. They double review surface and obscure what's actually being relocated.

## Comment markers

Use these consistently. Grep targets matter — follow-up passes hunt for each marker.

- `// TODO(refactor): <reason>` — couldn't translate confidently. Flag and move on.
- `// PERF(refactor): <what was lost>` — used to be in-process, now an RPC round-trip. Benchmark later.
- `// PORT NOTE: <reshape>` — the shape changed beyond a 1:1 move (split into two functions, async boundary moved, etc.). For readers comparing old vs. new.

---

## What moves where

| Today | New home |
|---|---|
| `apps/code/src/main/services/<X>/service.ts` — orchestration, retries, state machines, parsing, OAuth dances | `packages/core/<X>/service.ts` |
| Same file — the bits that touch git CLI / fs / spawn | `packages/workspace-server/<capability>/` (git → `git/`, fs → `fs/`, spawn → `process/`, etc.) |
| `apps/code/src/main/trpc/routers/<X>.ts` | Dumb procedures → registered from the relevant `workspace-server/<capability>/`. Orchestrating procedures **disappear** — core calls the clients directly. |
| `apps/code/src/api/<X>` (Django) | `packages/api-client/<X>` |
| `apps/code/src/renderer/features/<X>/` (UI) | `packages/ui/<X>/` |
| `apps/code/src/renderer/stores/<X>.ts` (thin UI state) | `packages/ui/<X>/store.ts` (still Zustand, still thin) |
| `apps/code/src/main/platform-adapters/<X>.ts` | `apps/desktop/platform-adapters/<X>.ts` |

---

## Per-feature procedure

Do these in order. One feature at a time.

1. **Audit.** Grep for the feature. List every file: main service, schemas, router, store, components, hooks, subscriptions, tests. If the audit doesn't fit in one paragraph, split the feature (see [Splitting a mega-feature](#splitting-a-mega-feature)).
2. **Identify host calls.** Anything touching git CLI, fs, child-process spawn, native modules. Those become workspace-server procedures.
3. **Identify orchestration.** Retries, polling, dedup, state machines, multi-step flows, error normalization. That's core.
4. **Define the workspace-server router first.** Dumb procedures only, Zod input + output. Add it to `appRouter` in `packages/workspace-server/src/trpc.ts`.
5. **Port orchestration to `packages/core/<feature>/`.** Pure JS. Inject `workspace-client` and `api-client` via constructor params — **no Inversify in core.** Unit test it.
6. **Wire the UI.** Lift to `packages/ui/features/<feature>/` if shareable, or keep in the app. The component imports core; core imports the clients.
7. **Delete the old main service and router.** No shims, no compatibility re-exports.
8. **Apply in-slice cleanups.** See below.
9. **Add a MIGRATION.md entry.** What moved, what was cleaned, what was deliberately left.

---

## Splitting a mega-feature

Some features are too large to move in one pass — the canonical example is the renderer-side `sessions` module (thousands of lines, owns its own state machines, holds subscriptions, reaches into other stores). Trying to port that in one go is how a refactor stalls for a week.

When the audit blows past one paragraph, **carve the feature into slices and migrate slice-by-slice**, not file-by-file. A slice is the smallest user-visible capability that can stand on its own: "list sessions," "create session," "session detail view," "session permissions stream." Each slice is its own pass through the per-feature procedure above, with its own MIGRATION.md entry.

Rules for slicing:

- **Pick the most read-only slice first.** Lists and detail views before mutations. Mutations before subscriptions. Subscriptions before anything that coordinates across other features.
- **The old module stays alive until the last slice lands.** New `packages/core/<feature>/` and old `apps/code/src/...` coexist during the migration. That's fine — but the coexistence is the cost you're paying to land slices safely, not a permanent state. Don't add new code to the old module.
- **No shared helpers across the seam.** If a slice in `core/` needs a helper that still lives in the old module, copy it (mark with `// PORT NOTE: duplicated from <old path>, removed when <slice> lands`). Importing across the seam glues the two halves together and defeats the point.
- **Track the slices explicitly.** Open a tracking issue or a checklist at the top of MIGRATION.md for the feature. Each landed slice ticks a box. The feature isn't "migrated" until every box is ticked and the old module is deleted.
- **Stop and re-plan if a slice doesn't fit the model.** If you carve off "session detail view" and discover it can't be expressed without dragging half the state machine with it, that's a signal the slice boundary is wrong — not a signal to widen the slice. Re-slice.

If you can't find a clean first slice at all, the feature probably has a layering problem that needs to be named before the move starts. Raise it.

---

## Resolving forbidden patterns

When you encounter a forbidden pattern (see AGENTS.md) inside the code you're moving, fix it as part of the move. Don't extend the pattern, don't relocate it as-is. The technique for each:

**Multi-step flow in a store.** (OAuth dance, token refresh, polling, `let inFlightX: Promise | null` dedup.) Extract the flow as a class method on a new core module. Inject `workspace-client` / `api-client` via constructor. The class owns the dedup promise, the retry loop, the state machine. The store keeps a single `status` field and a thin action that calls the method. Test the core class with mocked clients.

**Cross-store reach-in.** (`useOtherStore.getState().something()` inside a store action.) Find the system event that triggered the reach-in. Make core emit a typed event for it. Each affected store subscribes via its feature's `subscriptions.ts` registrar and reacts independently. No store imports another.

**Business client held in a store.** (`client: createClient(region, projectId)` field.) Construct the client in core, keyed by whatever id the store cared about. The store keeps the serializable id (`activeProjectId: string`). Components ask core for the client when they need it.

**Store owning a subscription.** (`let globalSubscription = trpcClient.X.subscribe(...)` at module scope.) Move the subscribe call into the feature's `subscriptions.ts` registrar, wired once at app boot. The store exposes a setter the registrar calls with each event.

**Store owning a domain timer.** (`window.setTimeout(() => removeClone(id), 3000)`.) The lifecycle belongs in core. Core schedules the cleanup and emits a `Removed` event when it fires. Store reacts to the event like any other.

**Custom hook orchestrating multiple queries.** (Two `useQuery` calls + a `useMemo` merge.) Replace with one core function that does the merge and exposes a single shape. Component uses one `useQuery` (or a derived hook over the single core call).

**Imperative `trpcClient` from a component.** (`useEffect(() => trpcClient.X.query().then(setState))`.) Replace with `useQuery`. If the component needs the result imperatively for a side effect, use `queryClient.fetchQuery` rather than reaching past the cache.

**tRPC router bypassing its service to call a repository.** Move every repository call into a service method. Router calls service. Never router → repository.

**tRPC router with inline business logic.** (Math, time arithmetic, conditional branching inside `.mutation`/`.query`.) Move the logic into a service method (workspace-server) or a core function. The router becomes a one-line forwarder.

**tRPC router with no backing service.** Create the service. Router shrinks to one-liners over it. If the existing router is a junk drawer (`os.ts`), split it: workspace-server procedures for host syscalls, `@posthog/platform` interfaces for host capabilities.

**`container.get(X)` inside a service method.** That's a circular-dep dodge. Either: (a) split the service — the part X needs probably belongs in a third module both depend on, or (b) invert the relationship via events — X emits, the dependent listens. Never paper over with `container.get`.

**Renderer service fetching domain data or coordinating tRPC.** Move the whole module to `packages/core/<feature>/`. If parts of it are genuinely UI mechanics (drag-and-drop, focus rings), split those off into a thin renderer-side helper.

**Platform adapter with business logic.** Strip the decisions out. Adapter does one syscall / one host-API call and returns. The decision lives in a service that depends on the adapter via its interface.

**`import from "electron"` in service code.** Define the capability as an interface in `packages/platform` (`INotifier`, `IClipboard`, etc.). Service depends on the interface. Per-app adapter implements it.

If you find debt that isn't a forbidden pattern and isn't a layering fix, **leave it.** Note it in MIGRATION.md and move on.

---

## Recommended order

1. **Read-only, no subscriptions.** Done — diff-stats.
2. **Read-only, subscription-based** (file-watcher, sync-status). Proves the streaming transport.
3. **Write paths** (focus mode, worktree ops).
4. **Terminal / pty proxying.** Most ambitious. Tests the full pipeline including binary data.

---

## MIGRATION.md format

Add an entry as each feature lands. Ten lines max:

```
## 2026-MM-DD — <feature>

- Moved: `apps/code/src/main/services/<X>/` → `packages/<core|workspace-server>/<X>/`
- Cleaned: <one line per layering fix>
- Left as-is: <one line per deliberate skip>
- New import path: `<new path>` (was `<old path>`)
```
