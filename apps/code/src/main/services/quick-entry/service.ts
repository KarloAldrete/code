import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { logger } from "../../utils/logger";
import { TypedEventEmitter } from "../../utils/typed-event-emitter";
import {
  createQuickEntryWindow,
  destroyQuickEntryWindow,
  hideQuickEntryWindow,
  isQuickEntryWindowFocused,
  isQuickEntryWindowVisible,
  showAndFocusMainWindow,
  showQuickEntryWindow,
} from "../../window";
import type { FoldersService } from "../folders/service";
import {
  type CreateTaskRequest,
  QuickEntryServiceEvent,
  type QuickEntryServiceEvents,
  type RecentRepoEntry,
} from "./schemas";

const log = logger.scope("quick-entry");

const BLUR_HIDE_GRACE_MS = 120;
const SHOW_GRACE_MS = 200;

@injectable()
export class QuickEntryService extends TypedEventEmitter<QuickEntryServiceEvents> {
  private suppressBlurHide = false;
  private windowCreated = false;

  constructor(
    @inject(MAIN_TOKENS.FoldersService)
    private readonly foldersService: FoldersService,
  ) {
    super();
  }

  createWindow(): void {
    if (this.windowCreated) return;
    createQuickEntryWindow({
      onBlur: () => this.handleBlur(),
    });
    this.windowCreated = true;
  }

  private handleBlur(): void {
    if (this.suppressBlurHide) return;
    // Child popups (dropdowns) briefly steal focus — grace period before hiding.
    setTimeout(() => {
      if (!isQuickEntryWindowVisible()) return;
      if (isQuickEntryWindowFocused()) return;
      this.hide();
    }, BLUR_HIDE_GRACE_MS);
  }

  isVisible(): boolean {
    return isQuickEntryWindowVisible();
  }

  toggle(): void {
    if (this.isVisible()) {
      this.hide();
    } else {
      this.show();
    }
  }

  show(): void {
    this.suppressBlurHide = true;
    const ok = showQuickEntryWindow();
    if (!ok) {
      this.suppressBlurHide = false;
      return;
    }
    this.emit(QuickEntryServiceEvent.FocusInput, true);
    setTimeout(() => {
      this.suppressBlurHide = false;
    }, SHOW_GRACE_MS);
  }

  hide(): void {
    if (!isQuickEntryWindowVisible()) return;
    hideQuickEntryWindow();
    this.emit(QuickEntryServiceEvent.Hide, true);
  }

  requestCreateTask(request: CreateTaskRequest): void {
    this.hide();
    showAndFocusMainWindow();
    this.emit(QuickEntryServiceEvent.CreateTaskRequested, request);
  }

  async getRecentRepos(limit = 8): Promise<RecentRepoEntry[]> {
    const folders = await this.foldersService.getFolders();
    return folders
      .filter((f) => f.exists)
      .sort((a, b) => {
        const ta = new Date(a.lastAccessed).getTime();
        const tb = new Date(b.lastAccessed).getTime();
        return tb - ta;
      })
      .slice(0, limit)
      .map((f) => ({
        id: f.id,
        path: f.path,
        name: f.name,
        remoteUrl: f.remoteUrl,
      }));
  }

  dispose(): void {
    destroyQuickEntryWindow();
    this.windowCreated = false;
    log.info("Quick entry service disposed");
  }
}
