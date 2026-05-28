import { z } from "zod";

export const directoryEntrySchema = z.object({
  name: z.string(),
  path: z.string(),
  type: z.enum(["file", "directory"]),
});

export type DirectoryEntry = z.infer<typeof directoryEntrySchema>;

export const listDirectoryInput = z.object({ dirPath: z.string().min(1) });
export const listDirectoryOutput = z.array(directoryEntrySchema);
