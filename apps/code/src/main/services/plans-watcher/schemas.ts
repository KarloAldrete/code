import { z } from "zod";

export const PlansWatcherEvent = {
  PlanFileChanged: "plan-file-changed",
  PlanFileDeleted: "plan-file-deleted",
} as const;

export type PlanFileChangedPayload = {
  filePath: string;
};

export type PlanFileDeletedPayload = {
  filePath: string;
};

export interface PlansWatcherEvents {
  [PlansWatcherEvent.PlanFileChanged]: PlanFileChangedPayload;
  [PlansWatcherEvent.PlanFileDeleted]: PlanFileDeletedPayload;
}

export const planReadInput = z.object({
  filePath: z.string(),
});

export const planReadOutput = z.object({
  content: z.string().nullable(),
});

export const speakerSchema = z.enum(["H", "A"]);

/**
 * `blockText` is the verbatim source markdown text of the block the thread is
 * anchored to (e.g. the paragraph or heading the user clicked `+` on). The
 * main process finds the matching block in the file by string-searching for
 * this snippet, then inserts or extends the trailing thread blockquote.
 *
 * `occurrence` disambiguates repeated blocks (two headings with the same
 * text, two identical bullets) — it's the 0-based index of the matching
 * block in document order. The renderer computes this from the position
 * of the block in the rendered tree.
 */
export const planAppendInput = z.object({
  filePath: z.string(),
  blockText: z.string().min(1),
  occurrence: z.number().int().nonnegative().default(0),
  message: z.string().min(1),
  speaker: speakerSchema,
});

export const planResolveInput = z.object({
  filePath: z.string(),
  blockText: z.string().min(1),
  occurrence: z.number().int().nonnegative().default(0),
});

export type PlanReadInput = z.infer<typeof planReadInput>;
export type PlanReadOutput = z.infer<typeof planReadOutput>;
export type PlanAppendInput = z.infer<typeof planAppendInput>;
export type PlanResolveInput = z.infer<typeof planResolveInput>;
export type Speaker = z.infer<typeof speakerSchema>;
