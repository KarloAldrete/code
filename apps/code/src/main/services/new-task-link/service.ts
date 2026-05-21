import type { IMainWindow } from "@posthog/platform/main-window";
import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { logger } from "../../utils/logger";
import { TypedEventEmitter } from "../../utils/typed-event-emitter";
import type { DeepLinkService } from "../deep-link/service";

const log = logger.scope("new-task-link-service");

export const NewTaskLinkEvent = {
  OpenNewTask: "openNewTask",
} as const;

export interface NewTaskLinkEvents {
  [NewTaskLinkEvent.OpenNewTask]: PendingNewTaskDeepLink;
}

export interface PendingNewTaskDeepLink {
  prompt: string;
}

@injectable()
export class NewTaskLinkService extends TypedEventEmitter<NewTaskLinkEvents> {
  private pendingDeepLink: PendingNewTaskDeepLink | null = null;

  constructor(
    @inject(MAIN_TOKENS.DeepLinkService)
    private readonly deepLinkService: DeepLinkService,
    @inject(MAIN_TOKENS.MainWindow)
    private readonly mainWindow: IMainWindow,
  ) {
    super();

    this.deepLinkService.registerHandler("new", (_path, params) =>
      this.handleNewTaskLink(params),
    );
  }

  private handleNewTaskLink(params: URLSearchParams): boolean {
    const prompt = params.get("prompt") ?? "";

    if (!prompt.trim()) {
      log.warn("New task link missing prompt");
      return false;
    }

    const payload = { prompt };
    const hasListeners = this.listenerCount(NewTaskLinkEvent.OpenNewTask) > 0;

    if (hasListeners) {
      log.info("Emitting new task link event");
      this.emit(NewTaskLinkEvent.OpenNewTask, payload);
    } else {
      log.info("Queueing new task link (renderer not ready)");
      this.pendingDeepLink = payload;
    }

    if (this.mainWindow.isMinimized()) {
      this.mainWindow.restore();
    }
    this.mainWindow.focus();

    return true;
  }

  public consumePendingDeepLink(): PendingNewTaskDeepLink | null {
    const pending = this.pendingDeepLink;
    this.pendingDeepLink = null;
    if (pending) {
      log.info("Consumed pending new task link");
    }
    return pending;
  }
}
