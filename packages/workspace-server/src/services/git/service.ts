import { type DiffStats, getDiffStats } from "@posthog/git/queries";
import { injectable } from "inversify";

@injectable()
export class GitService {
  async getDiffStats(directoryPath: string): Promise<DiffStats> {
    return getDiffStats(directoryPath);
  }
}
