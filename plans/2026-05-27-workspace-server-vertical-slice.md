# Handoff: workspace-server vertical slice

**Date:** 2026-05-27
**Branch:** `05-27-refactor_new_package_architecture`
**Status:** First vertical slice landed end-to-end. Diff-stats data flows through the new architecture in apps/code.

---

## Goal

Refactor PostHog Code from a monolithic Electron app into a multi-platform-ready package architecture. The load-bearing claim: `workspace-server` runs identically locally (spawned by Electron) and in a cloud sandbox (reached via a relay) — same bundle, different transport.

The vertical stab validates the architecture by porting one read-only feature end-to-end before generalizing.

---

## Architecture (current)

```
packages/
├── core              # zero-dep pure domain. Empty placeholder.
├── api-client        # talks to PostHog API (Django). Empty placeholder.
├── workspace-client  # tRPC client + React Query provider for workspace-server. Real code.
├── workspace-server  # Hono+tRPC server hosting privileged work (git, fs, ...). Real code.
├── ui                # React layer with feature folders. Has diff-stats feature.
├── platform          # interface-only host capabilities. Untouched in this slice.
└── shared            # zero-dep utilities. Pre-existing, planned merge into core.

tooling/
├── typescript        # shared tsconfigs (base, node-package, react-package)
└── tsup-config       # shared tsup factory (created earlier, mostly unused now)
```

**Workspace-server lifecycle:** spawned as a separate Node child process by `apps/code/src/main/services/workspace-server/service.ts` (Inversify-injected). Uses `ELECTRON_RUN_AS_NODE=1` so Electron's bundled Node runs the bundled `workspace-server.js`. PSK auth (`x-workspace-secret` header) between processes. Health-poll on `/health` before declaring ready.

**Renderer access:** apps/code/main exposes `workspaceServer.getConnection` via the existing electron-trpc bridge. Renderer's `ConnectedWorkspaceProvider` fetches the connection and mounts `WorkspaceClientProvider` (from `@posthog/workspace-client/provider`). Components use `useWorkspaceTRPC` from the package + `trpc.x.y.queryOptions(...)` per the official `@trpc/tanstack-react-query` pattern.

---

## Current Progress

### Packages landed

| Package | Files | Notes |
|---|---|---|
| `@posthog/workspace-server` | `app.ts` (Hono+PSK), `trpc.ts` (router + diffStats schema), `serve.ts` (child entry + watchdog), `services/git/service.ts` (`@injectable()` GitService), `di/{container,tokens}.ts` (Inversify) | Inversify configured with `experimentalDecorators` + `emitDecoratorMetadata` in tsconfig. `reflect-metadata` imported at the top of `serve.ts` + `di/container.ts`. |
| `@posthog/workspace-client` | `client.ts` (createWorkspaceClient factory), `trpc.tsx` (createTRPCContext exports: WorkspaceTRPCProvider, useWorkspaceTRPC, useWorkspaceTRPCClient), `provider.tsx` (host-agnostic WorkspaceClientProvider taking connection prop) | Uses `react-package` tsconfig (JSX). httpBatchLink with placeholder URL until connection arrives. |
| `@posthog/ui` | `src/features/diff-stats/{useDiffStats.ts, DiffStatsBadge.tsx}` | Camel/Pascal names per React conventions. Wildcard array-fallback exports handle both extensions. |

### Apps/code wiring

- `src/main/services/workspace-server/service.ts` — Inversify service replacing the old `lib/workspace-server-coordinator.ts` (deleted). Methods: `start()`, `stop()`, `getConnection()`. Concurrent-start dedup via `pendingStart`.
- `src/main/trpc/routers/workspace-server.ts` — single procedure `getConnection` returning `{ url, secret }`. Auto-starts the service if not running.
- `src/main/index.ts` — `whenReady` calls `service.start()`; `before-quit` calls `service.stop()`.
- `src/renderer/components/Providers.tsx` — `ConnectedWorkspaceProvider` fetches connection + mounts `WorkspaceClientProvider`.
- `src/renderer/features/code-review/hooks/useEffectiveDiffSource.ts` — swapped `trpc.git.getDiffStats` for `useDiffStats(repoPath ?? null)` from `@posthog/ui`.
- `src/renderer/components/HeaderRow.tsx` — inlined `TaskDiffStatsBadge` (uses `useDiffStatsToggle` + portable `<DiffStatsBadge>` from `@posthog/ui`). Old wrapper file deleted.

### Build wiring

- `apps/code/vite.workspace-server.config.mts` — minimal Vite config bundling `workspace-server.js`. Entry via `require.resolve("@posthog/workspace-server/serve")`. Externalizes all `node_modules` except `@posthog/*`. Output forced to `workspace-server.js` via `rollupOptions.output.entryFileNames` (vite's `lib.fileName` is ignored under `ssr: true`).
- `apps/code/forge.config.ts` — added third Vite build entry pointing at `node_modules/@posthog/workspace-server/src/serve.ts`.
- `apps/code/vite.shared.mts` — added regex aliases for `@posthog/{core,api-client,ui,workspace-client,workspace-server}` pointing at each package's `src/`. Enables HMR.

### Catalogs + biome

- `pnpm-workspace.yaml` — catalog entries for `hono`, `@hono/*`, `@trpc/*`, `@tanstack/react-query`, `@phosphor-icons/react`, `@radix-ui/themes`, `@posthog/quill`, `inversify`, `reflect-metadata`, `superjson`, `zod`, `react*`, `typescript`, `tsup`.
- `biome.jsonc` — boundary rules per package (`@posthog/*` glob with `!` exceptions for allowed siblings). Smoke-tested that violations fire with the right message.

---

## What worked

### Architecture decisions

1. **Separate child process for workspace-server (not embed)** — pays off because the bundle is sandbox-identical, native deps don't bloat Electron, crash isolation. Spawning via `ELECTRON_RUN_AS_NODE=1` matches Superset's pattern.
2. **Inversify only inside workspace-server (and apps/code/main).** Other packages use plain factories. Decorators kept narrow to where DI pulls weight.
3. **`@trpc/tanstack-react-query`'s `createTRPCContext` pattern** — proper provider + `useTRPC()` instead of manual `useQuery({ queryFn })` shims.
4. **Generic provider in workspace-client + host-specific connection-fetching in apps/code.** `WorkspaceClientProvider` knows nothing about how to obtain a connection; `ConnectedWorkspaceProvider` in apps/code does.
5. **Non-blocking mount via placeholder URL** — `WorkspaceClientProvider` always wraps children. Pre-connection, the client points at a sentinel URL; queries fail until connection arrives. App renders independent of workspace-server boot.

### Resolution patterns

6. **Turborepo Just-in-Time wildcard exports** (`"./*": ["./src/*.ts", "./src/*.tsx"]`) — single line per package, no per-file maintenance, no barrels, no build step. **This is the official pattern.** Works with `moduleResolution: bundler` because extensions are explicit in the array fallback.
7. **No `index.ts` barrels.** Each file is its own subpath; imports look like `@posthog/ui/features/diff-stats/DiffStatsBadge`.
8. **Vite aliases in `vite.shared.mts`** for HMR: regex `/^@posthog\/<pkg>\/(.+)$/` → `packages/<pkg>/src/$1`. Vite resolves extensions.

### Tooling

9. **pnpm catalogs** for all shared external dep versions.
10. **biome `noRestrictedImports` with `@posthog/*` allowlist exceptions** — enforces package boundaries. Caught real violations during the session.

---

## What didn't work (avoid these)

1. **Wildcard exports `"./*": "./src/*"` (no extensions).** Tested empirically: TypeScript under `moduleResolution: bundler` does NOT try `.ts`/`.tsx` extensions through exports. Returns "Cannot find module" errors. Use the array-fallback form instead.
2. **tsconfig `paths` pointing at sibling packages' `src/`.** Conflicts with `apps/code/tsconfig.node.json`'s `rootDir: ./src` — TS complains about source files outside rootDir. Removing rootDir works but pokes at unrelated config. **Turborepo's wildcard exports are simpler and cleaner.**
3. **`useMemo([connection])` for client construction.** React Query can produce new object references with identical data, churning the client. Use primitives `[url, secret]` instead. (Currently resolved by the placeholder-URL pattern — the client rebuilds only when the URL actually changes.)
4. **Conditional render in `WorkspaceClientProvider` (`if (!client) return null`).** Blocks the entire app on workspace-server boot. Replaced with always-mount + placeholder URL.
5. **`httpBatchLink({ url: () => ... })`** — `url` doesn't accept a function in `@trpc/client@11`. Must be string.
6. **`staleTime: Number.POSITIVE_INFINITY` on the connection query.** Stale url+secret persists forever after a child crash. Now `30_000`. True invalidation on child death is a deferred improvement.
7. **Keeping the workspace-server child entry in `apps/code/src/main/`** — instead it belongs in `packages/workspace-server/src/serve.ts` (it's the package's own runtime shape; apps/code just bundles it).
8. **Per-file `exports` entries in package.json.** Tedious. Replaced with wildcard.
9. **A separate `WorkspaceTRPCBridge` component in apps/code.** The "construct client + mount provider" logic is generic — moved into `WorkspaceClientProvider` in the package. Only host-specific glue (the connection fetch) stays in apps/code.

---

## Open concerns (from final review)

### High

- **No connection invalidation on child death.** If workspace-server crashes mid-session, the cached `workspaceServer.getConnection` query (staleTime 30s) holds the stale url+secret. Calls fail until React Query's window-focus refetch or 30s passes. Real fix: emit an event from main when the child exits, invalidate the connection query from the renderer.

### Medium

- **Schema-vs-type drift direction.** `diffStatsSchema: z.ZodType<DiffStats>` catches type narrowing but not optional-field additions (silently stripped at the wire). Consider inverting: `type DiffStats = z.infer<typeof diffStatsSchema>` and assignability-check against `@posthog/git`'s `DiffStats`.
- **Failed diff query masks as zero stats.** `data: diffStats = emptyDiffStats` silently swallows errors. Pre-existing pattern, but failure surface grew (HTTP can now fail).

### Low

- PSK comparison non-constant-time (`a !== b`) — should use `timingSafeEqual`. Cosmetic for localhost.
- PSK visible to same-uid processes via `/proc/<pid>/environ` on Linux. Document as acceptable for local case.

---

## Next steps

### Immediate (small)

1. **Connection invalidation on child death.** Add an event channel (existing electron-trpc subscription works) or polling. Renderer invalidates `workspaceServer.getConnection` when notified.
2. **Schema source-of-truth inversion** in `packages/workspace-server/src/trpc.ts` — derive `DiffStats` from the zod schema, assignability-check against `@posthog/git`.
3. **PSK `timingSafeEqual`** — drop-in replacement in `packages/workspace-server/src/app.ts`.

### Next vertical slice

4. **Port a second feature** through the same pipeline. Candidates (in order of value):
   - **File tree / file watcher** — exercises subscriptions (a hole the diff-stats slice didn't fill). Long-lived streams over HTTP+WS.
   - **Git status indicator (sync status)** — was the original first-choice; rolled back to keep diff-stats focused. Easy second slice now that the pipeline exists.
   - **Terminal output** — most ambitious; tests pty proxying through workspace-server.

### Medium-term migrations

5. **Fold `packages/shared` into `packages/core`.** Both are zero-dep utility packages. CLAUDE.md still references `@posthog/shared`.
6. **Decide auth flow location.** Currently smeared across `apps/code/src/main/services/auth/`. It cross-cuts platform (secure storage), api-client (refresh endpoint), workspace-server (acting on behalf of user). First domain that genuinely needs a vertical-slice package (`packages/domains/auth/`?).
7. **Define the relay protocol.** Today workspace-server is local-only. For cloud sandboxes, we need a Django-mediated relay (Superset has one — `apps/relay/` in their repo). This unblocks cloud parity.

### Architectural housekeeping

8. **Cloud diff path will collapse.** `useTaskDiffSummaryStats` currently has 4 modes (local/branch/PR/cloud). Long-term, all roads lead to workspace-server (local OR sandboxed). When the relay exists, `useDiffStats` works for cloud too — `useCloudChangedFiles` deletes.
9. **Document the architecture decisions** in `docs/architecture.md`. The current doc predates this refactor.

---

## Useful references

- **Turborepo Just-in-Time wildcard exports** — official pattern, the `["./src/*.ts", "./src/*.tsx"]` array fallback is the documented approach.
- **Superset's `apps/desktop/src/main/lib/host-service-coordinator.ts`** — the spawn-via-Electron-Node pattern we mirrored. Theirs has more features (stable-port hashing, manifest file, dev-reload watcher) that may be worth borrowing later.
- **biome.jsonc** — the package boundary enforcement. Each new package needs its own override block following the established pattern.
- **`apps/code/scripts/`** — the smoke script (`smoke-workspace-server.mjs`) was deleted at the end of the session. If you want end-to-end validation during dev, recreate or use the running app.

---

## Files to read for context

In rough order of importance:

1. `packages/workspace-server/src/serve.ts` — child process entry
2. `packages/workspace-server/src/app.ts` — Hono factory + PSK auth
3. `packages/workspace-server/src/trpc.ts` — router (one procedure: `diffStats.getDiffStats`)
4. `apps/code/src/main/services/workspace-server/service.ts` — coordinator-as-service
5. `apps/code/src/main/trpc/routers/workspace-server.ts` — `getConnection` procedure
6. `packages/workspace-client/src/provider.tsx` — host-agnostic provider with placeholder-URL non-blocking pattern
7. `packages/workspace-client/src/trpc.tsx` — createTRPCContext exports
8. `apps/code/src/renderer/components/Providers.tsx` — host-specific connection bridge
9. `apps/code/src/renderer/features/code-review/hooks/useEffectiveDiffSource.ts` — example consumer
10. `apps/code/vite.workspace-server.config.mts` + `forge.config.ts` — build wiring
11. `pnpm-workspace.yaml` — catalogs
12. `biome.jsonc` — package boundary rules
