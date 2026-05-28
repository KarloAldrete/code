import { z } from "zod";
import { container } from "../../di/container";
import { MAIN_TOKENS } from "../../di/tokens";
import type { FileWatcherBridge } from "../../services/file-watcher/bridge";
import { publicProcedure, router } from "../trpc";

const watcherInput = z.object({ repoPath: z.string() });

const getService = () =>
  container.get<FileWatcherBridge>(MAIN_TOKENS.FileWatcherService);

export const fileWatcherRouter = router({
  start: publicProcedure
    .input(watcherInput)
    .mutation(({ input }) => getService().startWatching(input.repoPath)),

  stop: publicProcedure
    .input(watcherInput)
    .mutation(({ input }) => getService().stopWatching(input.repoPath)),
});
