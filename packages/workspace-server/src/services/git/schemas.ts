import { z } from "zod";

export const diffStatsInput = z.object({ directoryPath: z.string().min(1) });

export const diffStatsSchema = z.object({
  filesChanged: z.number().int().nonnegative(),
  linesAdded: z.number().int().nonnegative(),
  linesRemoved: z.number().int().nonnegative(),
});

export type DiffStats = z.infer<typeof diffStatsSchema>;
