# Canvas branch port — handoff

How to port the remaining canvas branches onto the post-refactor (#2442) package
graph, building on the work already landed in `feat/canvas` (PR #2522).

## TL;DR

- `feat/canvas` (the canvas **MVP**) is ported and landed on the new package
  graph. That's the new base.
- **Only one branch is left worth porting: `feat/canvases-rename`** (75 commits).
  It's a *superset* of the MVP: dashboards→canvases rename, Quill charts, and the
  whole **templates + declarative-interactivity** stack (Phases 1 / 2 / 2.5,
  documented in `TEMPLATES.md`).
- `feat/canvas-quill` and `feat/canvas-harness-templates` both point to the same
  commit (`488a5827b`) and are **subsumed** by `feat/canvases-rename`. Don't port
  them — delete them after `feat/canvas` merges.

Do NOT try `git rebase` — the refactor relocated the whole renderer into packages
and changed the import-alias system, so a rebase becomes a per-commit re-port.
Apply the **net diff** of `feat/canvases-rename` over the old canvas as a fresh
port onto the new `feat/canvas`.

## Where things live now (the placement map the MVP established)

| Concern | New home | Notes |
|---|---|---|
| Renderer (components, genui, stores, hooks, subscriptions) | `packages/ui/src/features/canvas/` | pure UI, `@posthog/ui/*` imports, zero electron/node |
| Routes | `packages/ui/src/router/routes/website*` | file-based; regenerate the tree, never hand-merge `routeTree.gen.ts` |
| Schemas + DI tokens + service interfaces | `packages/core/src/canvas/` | `dashboardSchemas.ts`, `genSchemas.ts`, `querySchemas.ts`, `identifiers.ts`, `services.ts` |
| Host-agnostic services (dashboards, dashboard-query) | `packages/core/src/canvas/` | inject the **core** `AUTH_SERVICE` (`@posthog/core/auth/auth.module`) + `ROOT_LOGGER`; bound via `canvasCoreModule` |
| Agent-coupled service (canvas-gen) | `packages/host-router/src/services/canvas-gen.service.ts` | see the **dependency-cycle rule** below |
| tRPC routers | `packages/host-router/src/routers/*.router.ts` | `ctx.container.get<IFace>(TOKEN)`; register in `packages/host-router/src/router.ts` (`hostRouter`) |
| Feature flag | `packages/shared/src/flags.ts` | `PROJECT_BLUEBIRD_FLAG` |
| Shell wiring | `packages/ui/src/router/routes/__root.tsx` | AppNav rail + Channels space, gated by the flag; flag-off redirect guard off `/website` |

## The two load-bearing architecture rules

1. **`apps/code` must stay a thin Electron host.** CI runs
   `scripts/check-host-boundaries.mjs`: **no `@injectable` business services in
   `apps/code`** (only platform-adapters / di). Every canvas service must live in
   a package. (`apps/code` may still *bind* tokens in `di/container.ts`.)

2. **Dependency cycle constraint.** `@posthog/core → workspace-client →
   workspace-server`, so **`workspace-server` cannot depend on `core`**, and
   `core` cannot depend on `workspace-server`. Therefore:
   - Services needing only auth+fetch → `packages/core` (inject core `AUTH_SERVICE`).
   - Services needing the **agent runtime** (`@posthog/workspace-server`) **and**
     auth/schemas (`@posthog/core`) → **`packages/host-router`** (the only package
     that depends on both without a cycle). That's why `canvas-gen` lives there.
     The renderer imports host-router **type-only**, so its node code never
     bundles.

## Renderer→main is host-router tRPC, not the old `trpcClient`

- React components/hooks: `useHostTRPC()` (query-options proxy) / `useHostTRPCClient()`
  (imperative `.mutate`) from `@posthog/host-router/react`.
- **Stores / subscription registrars (non-React):** `resolveService<HostTrpcClient>(HOST_TRPC_CLIENT)`
  from `@posthog/di/container` + `@posthog/host-router/client`. See
  `features/canvas/hostClient.ts` for the accessor pattern.

## Import remap table (old alias → new)

```
@features/canvas/*                  → @posthog/ui/features/canvas/*
@features/<other>/*                 → @posthog/ui/features/<other>/*   (verify the symbol moved, names changed e.g. tasks/hooks/useTasks → tasks/useTasks)
@components/ErrorBoundary           → @posthog/ui/shell/ErrorBoundary
@renderer/utils/toast               → @posthog/ui/primitives/toast
@renderer/trpc/client (component)   → useHostTRPC / useHostTRPCClient
@renderer/trpc/client (store)       → resolveService(HOST_TRPC_CLIENT)  (hostClient.ts)
@renderer/api/generated (Schemas)   → @posthog/api-client
@utils/logger                       → @posthog/ui/shell/logger
@utils/time (formatRelativeTime*)   → @posthog/shared
@utils/queryClient                  → useQueryClient() hook (@tanstack/react-query)
@hooks/useAuthenticatedQuery        → @posthog/ui/hooks/useAuthenticatedQuery
@shared/types (Task)                → @posthog/shared/domain-types
@main/services/<svc>/schemas        → @posthog/core/canvas/<svc>Schemas  (move schemas to core)
```

Bulk-apply the unambiguous ones with `perl -0pi -e` over the canvas dir; do the
trpc/schema ones by hand. **The renderer must not import `@main/*` or
`@posthog/core/canvas/genSchemas` for runtime values** — get types from
`HostRouter` inference instead (keeps node code out of the bundle).

## DI wiring recipe (per service)

- **Token** (core): `packages/core/src/canvas/identifiers.ts` — `Symbol.for("posthog.core.canvas.…")`.
- **core service**: `@injectable()`, `@inject(AUTH_SERVICE)` + `@inject(ROOT_LOGGER)`; bound in `canvas.module.ts` (`bind(Class).toSelf().inSingletonScope(); bind(TOKEN).toService(Class)`); module `container.load`-ed in `apps/code/src/main/di/container.ts`.
- **host-router service** (canvas-gen): class in `packages/host-router/src/services/`, bound directly in `apps/code/.../container.ts` (`container.bind(TOKEN).to(Class).inSingletonScope()`), with a `[TOKEN]: Class` entry in `apps/code/.../bindings.ts` `MainBindings`.
- **router**: `publicProcedure.input(zod).output(zod).query/mutation(({ctx,input}) => ctx.container.get<IFace>(TOKEN).method(input))`; subscriptions via `service.toIterable(EVENT,{signal})`.

## What `feat/canvases-rename` adds over the landed MVP (the delta to port)

Read `TEMPLATES.md` for the full design. Concretely:

1. **Rename** dashboards → "canvases" (user-facing strings, breadcrumb leaf).
2. **Quill charts** — `LineChart`/`BarChart`/`Sparkline` bodies in `bodies.tsx`;
   add `@posthog/quill-charts` to `packages/ui/package.json`. (Note: vitest can't
   import quill-charts' dayjs subpath — add a resolve alias if you want body tests.)
3. **Templates (Phase 1)** — NEW main service `CanvasTemplatesService` (built-in
   Dashboard + Blank templates, per-template system prompt built from the shared
   catalog). It's host-agnostic (prompt strings) → **`packages/core`** + a
   `canvas-templates` router in host-router. Template picker UI (`NewCanvasMenu`,
   a Quill dialog), per-template chat suggestions.
3. **`canvas-gen` signature changed**: the MVP's `canvas-gen` takes a
   renderer-computed `systemPrompt`; canvases-rename moved prompt-building into
   main (`CanvasTemplatesService.systemPromptFor(templateId)`), so `generate`
   takes `templateId` + `currentSpec` instead. Reconcile this when porting —
   the canvas-gen service + its input schema + the renderer store all change.
4. **Phase 2 palette** — `Hero`/`Markdown`/`Button`/`Section` + background tones;
   per-template component **allow-list** (`canvasCatalogFor(names)` in
   `@shared/canvas/components` → moved to `packages/core` here).
5. **Phase 2.5 interactivity** — `CanvasProviders.tsx` wraps the walks in
   json-render's State/Action/Validation/Visibility providers; `{$state}` reads,
   `{$bindState}` two-way inputs (`TextInput`/`Checkbox`), `visible`, `on`/actions
   (the 4 built-ins). Inputs read/write the store via `useStateStore` (NOT
   `useBoundProp`, which only echoes its arg). Deferred: `repeat`/`$item`, A2UI
   agent round-trip.

## CI gates that WILL bite (all hit during the MVP port)

- **`Code Quality` → host-boundary check**: any `@injectable` in `apps/code` fails
  it. Move the service to a package (see cycle rule).
- **`react-doctor` (blocking: error)**: it flags `no-adjust-state-on-prop-change`
  — resetting state in a `useEffect` on a prop change. Fix with the inline
  **prev-prop comparison** pattern (`const [prev,setPrev]=useState(x); if(x!==prev){setPrev(x); …}`).
  Modal `useEffect(()=>{if(open)setX("")},[open])` patterns are the usual culprits.
  Warnings don't block; only `✖` errors do.
- **Conflicts / stale PR merge-ref**: if the branch conflicts with main, GitHub's
  merge ref goes stale and checks (react-doctor especially) run on **old** merged
  code → phantom failures. Resolve the conflict (merge main, regenerate
  `routeTree.gen.ts`) and they clear.
- **`@json-render/*` deps** must be added to each package that imports them
  (`@json-render/core` in `apps/code` + `packages/ui` + `packages/host-router`;
  `@json-render/react` in `packages/ui`). `@posthog/core` resolves from source
  (no rebuild); `@posthog/shared`/`platform` are built (`pnpm build` or
  `pnpm --filter @posthog/shared build`) so new exports need a rebuild before
  other packages see them.

## Verification (run all green before pushing)

```
pnpm install                       # after any package.json dep change
pnpm typecheck                     # 22/22 turbo tasks
node scripts/check-host-boundaries.mjs        # "No new violations"
npx react-doctor@0.4.2 . --blocking error --changed-files-from <changed.txt>   # 0 errors
pnpm biome check <touched dirs>    # lint
pnpm build                         # bundler-level confidence (heavy; rebuilds electron natives)
```

Gotcha: `pnpm build` rebuilds `better-sqlite3` for Electron, which then breaks
Node `pnpm test` with a `NODE_MODULE_VERSION` ABI mismatch. Fix the test env with
`pnpm rebuild better-sqlite3`. CI is unaffected (clean install).

## Flag-off safety (keep this invariant)

`PROJECT_BLUEBIRD_FLAG` gates the entire feature. With it off: no rail, no
Channels space, no boot side effects (services/subscriptions are lazy), and
`__root` redirects flag-off users off `/website` to Code. Default is
`import.meta.env.DEV` (on in dev, off in prod). Preserve this.
