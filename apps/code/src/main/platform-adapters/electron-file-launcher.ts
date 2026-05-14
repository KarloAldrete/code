import type { IFileLauncher } from "@posthog/platform/file-launcher";
import { shell } from "electron";
import { injectable } from "inversify";

@injectable()
export class ElectronFileLauncher implements IFileLauncher {
  public async openPath(
    path: string,
  ): Promise<{ ok: boolean; error: string | null }> {
    const error = await shell.openPath(path);
    return { ok: error === "", error: error === "" ? null : error };
  }

  public async showInFolder(path: string): Promise<void> {
    shell.showItemInFolder(path);
  }
}
