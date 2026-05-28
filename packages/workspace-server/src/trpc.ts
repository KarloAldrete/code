import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { container } from "./di/container";
import { TOKENS } from "./di/tokens";
import { listDirectoryInput, listDirectoryOutput } from "./services/fs/schemas";
import type { FsService } from "./services/fs/service";
import { diffStatsInput, diffStatsSchema } from "./services/git/schemas";
import type { GitService } from "./services/git/service";
import {
  resolveGitDirsInput,
  resolveGitDirsOutput,
  watchInput,
  watchRepoInput,
} from "./services/watcher/schemas";
import type { WatcherService } from "./services/watcher/service";

const t = initTRPC.create({ transformer: superjson });

const gitService = () => container.get<GitService>(TOKENS.GitService);
const fsService = () => container.get<FsService>(TOKENS.FsService);
const watcherService = () =>
  container.get<WatcherService>(TOKENS.WatcherService);

export { type DiffStats, diffStatsSchema } from "./services/git/schemas";
export {
  type FileWatcherEvent,
  FileWatcherEventKind,
} from "./services/watcher/schemas";

export const appRouter = t.router({
  diffStats: t.router({
    getDiffStats: t.procedure
      .input(diffStatsInput)
      .output(diffStatsSchema)
      .query(({ input }) => gitService().getDiffStats(input.directoryPath)),
  }),
  fs: t.router({
    listDirectory: t.procedure
      .input(listDirectoryInput)
      .output(listDirectoryOutput)
      .query(({ input }) => fsService().listDirectory(input.dirPath)),
  }),
  watcher: t.router({
    resolveGitDirs: t.procedure
      .input(resolveGitDirsInput)
      .output(resolveGitDirsOutput)
      .query(({ input }) => watcherService().resolveGitDirs(input.repoPath)),

    watch: t.procedure
      .input(watchInput)
      .subscription(({ input, signal }) =>
        watcherService().watch(input.dirPath, { ignore: input.ignore }, signal),
      ),
  }),
  fileWatcher: t.router({
    watch: t.procedure
      .input(watchRepoInput)
      .subscription(({ input, signal }) =>
        watcherService().watchRepo(input.repoPath, signal),
      ),
  }),
});

export type AppRouter = typeof appRouter;
