import type { WorkspaceClient } from "@posthog/workspace-client/client";
import type { FileWatcherEvent } from "@posthog/workspace-client/types";
import { TypedEventEmitter } from "../../utils/typed-event-emitter";

type FileWatcherEventsByKind = {
  [K in FileWatcherEvent["kind"]]: Extract<FileWatcherEvent, { kind: K }>;
};

export class FileWatcherBridge extends TypedEventEmitter<FileWatcherEventsByKind> {
  private subs = new Map<string, { unsubscribe: () => void }>();

  constructor(private workspace: WorkspaceClient) {
    super();
  }

  startWatching(repoPath: string): void {
    if (this.subs.has(repoPath)) return;
    const sub = this.workspace.fileWatcher.watch.subscribe(
      { repoPath },
      {
        onData: (event) => {
          this.emit(event.kind, event as never);
        },
        onError: () => {},
      },
    );
    this.subs.set(repoPath, sub);
  }

  stopWatching(repoPath: string): void {
    const sub = this.subs.get(repoPath);
    if (!sub) return;
    sub.unsubscribe();
    this.subs.delete(repoPath);
  }
}
