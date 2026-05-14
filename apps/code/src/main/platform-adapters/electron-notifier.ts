import { existsSync } from "node:fs";
import path from "node:path";
import type { INotifier, NotifyOptions } from "@posthog/platform/notifier";
import { app, Notification, nativeImage } from "electron";
import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../di/tokens";
import { logger } from "../utils/logger";
import type { ElectronMainWindow } from "./electron-main-window";

const STARTUP_FRAMES = ["wave.png", "build.png"];
const STARTUP_FRAME_INTERVAL_MS = 700;

const log = logger.scope("electron-notifier");

function getDockFramesDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "dock-frames");
  }
  return path.join(app.getAppPath(), "build", "dock-frames");
}

@injectable()
export class ElectronNotifier implements INotifier {
  constructor(
    @inject(MAIN_TOKENS.MainWindow)
    private readonly mainWindow: ElectronMainWindow,
  ) {}

  public isSupported(): boolean {
    return Notification.isSupported();
  }

  public notify(options: NotifyOptions): void {
    const notification = new Notification({
      title: options.title,
      body: options.body,
      silent: options.silent,
    });
    if (options.onClick) {
      notification.on("click", options.onClick);
    }
    notification.show();
  }

  public setUnreadIndicator(on: boolean): void {
    if (on) {
      app.dock?.setBadge("•");
    } else {
      app.dock?.setBadge("");
      this.mainWindow.getBrowserWindow()?.flashFrame(false);
    }
  }

  public requestAttention(): void {
    app.dock?.bounce("informational");
    this.mainWindow.getBrowserWindow()?.flashFrame(true);
  }

  public playStartupAnimation(): void {
    const dock = app.dock;
    if (process.platform !== "darwin" || !dock) return;

    const dir = getDockFramesDir();
    const frames = STARTUP_FRAMES.map((name) => path.join(dir, name)).filter(
      (p) => existsSync(p),
    );
    if (frames.length === 0) {
      log.info("No dock animation frames found", { dir });
      return;
    }

    let index = 0;
    const tick = () => {
      const frame = frames[index];
      try {
        const image = nativeImage.createFromPath(frame);
        if (!image.isEmpty()) dock.setIcon(image);
      } catch (err) {
        log.warn("Failed to set dock icon", { frame, err });
      }
      index += 1;
      if (index < frames.length) {
        setTimeout(tick, STARTUP_FRAME_INTERVAL_MS);
      }
    };

    dock.bounce("informational");
    tick();
  }
}
