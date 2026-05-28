import fs from "node:fs/promises";
import path from "node:path";
import { injectable } from "inversify";
import type { DirectoryEntry } from "./schemas";

@injectable()
export class FsService {
  async listDirectory(dirPath: string): Promise<DirectoryEntry[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter((e) => !e.name.startsWith("."))
        .map((e) => ({
          name: e.name,
          path: path.join(dirPath, e.name),
          type: e.isDirectory() ? ("directory" as const) : ("file" as const),
        }))
        .sort((a, b) =>
          a.type !== b.type
            ? a.type === "directory"
              ? -1
              : 1
            : a.name.localeCompare(b.name),
        );
    } catch {
      return [];
    }
  }
}
