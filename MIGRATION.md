# MIGRATION.md — landed slice log

Running log of what moved and where. Ten lines per entry max.

For the procedure to follow when porting a new feature, see [REFACTOR.md](./REFACTOR.md).

---

## 2026-05-27 — diff-stats

- Moved: `apps/code/src/main/services/git/getDiffStats` → `packages/workspace-server/src/services/git/service.ts` + `packages/ui/src/features/diff-stats/`
- New: `@posthog/workspace-server`, `@posthog/workspace-client`, `@posthog/ui` packages. Workspace-server runs as a child process spawned by Electron (`ELECTRON_RUN_AS_NODE=1`).
- Cleaned: PSK comparison now uses `timingSafeEqual`. `DiffStats` schema is the source of truth (`z.infer`), not the type. Connection query invalidates on child exit via a tRPC subscription.
- Left as-is: `useTaskDiffSummaryStats` still has 4 modes (local/branch/PR/cloud). Collapses once the relay protocol exists.
- New import paths: `useDiffStats(repoPath)` from `@posthog/ui/features/diff-stats/useDiffStats` (was `trpc.git.getDiffStats`). `DiffStatsBadge` from `@posthog/ui/features/diff-stats/DiffStatsBadge`.
