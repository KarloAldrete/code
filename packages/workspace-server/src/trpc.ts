import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import { container } from "./di/container";
import { TOKENS } from "./di/tokens";
import type { GitService } from "./services/git/service";

const t = initTRPC.create({ transformer: superjson });

const gitService = () => container.get<GitService>(TOKENS.GitService);

export const diffStatsSchema = z.object({
  filesChanged: z.number().int().nonnegative(),
  linesAdded: z.number().int().nonnegative(),
  linesRemoved: z.number().int().nonnegative(),
});

export type DiffStats = z.infer<typeof diffStatsSchema>;

export const appRouter = t.router({
  diffStats: t.router({
    getDiffStats: t.procedure
      .input(z.object({ directoryPath: z.string().min(1) }))
      .output(diffStatsSchema)
      .query(({ input }) => gitService().getDiffStats(input.directoryPath)),
  }),
});

export type AppRouter = typeof appRouter;
