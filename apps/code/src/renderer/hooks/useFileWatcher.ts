import {
  invalidateGitBranchQueries,
  invalidateGitWorkingTreeQueries,
} from "@features/git-interaction/utils/gitCacheKeys";
import { usePanelLayoutStore } from "@features/panels/store/panelLayoutStore";
import { useFileWatcher as useFileWatcherUI } from "@posthog/ui/features/file-watcher/useFileWatcher";
import type { FileWatcherEvent } from "@posthog/workspace-client/types";
import { trpcClient, useTRPC } from "@renderer/trpc/client";
import { useQueryClient } from "@tanstack/react-query";
import { logger } from "@utils/logger";
import { toRelativePath } from "@utils/path";
import { useCallback, useEffect } from "react";

const log = logger.scope("file-watcher");

export function useFileWatcher(repoPath: string | null, taskId?: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const closeTabsForFile = usePanelLayoutStore((s) => s.closeTabsForFile);

  useEffect(() => {
    if (!repoPath) return;
    trpcClient.fileWatcher.start.mutate({ repoPath }).catch((error) => {
      log.error("Failed to start main-side file watcher:", error);
    });
    return () => {
      trpcClient.fileWatcher.stop.mutate({ repoPath });
    };
  }, [repoPath]);

  const onEvent = useCallback(
    (event: FileWatcherEvent) => {
      if (!repoPath) return;
      switch (event.kind) {
        case "file-changed": {
          const relativePath = toRelativePath(event.filePath, repoPath);
          queryClient.invalidateQueries(
            trpc.fs.readRepoFile.queryFilter({
              repoPath,
              filePath: relativePath,
            }),
          );
          queryClient.invalidateQueries(
            trpc.fs.readRepoFileBounded.queryFilter({
              repoPath,
              filePath: relativePath,
            }),
          );
          return;
        }
        case "file-deleted": {
          if (!taskId) return;
          closeTabsForFile(taskId, toRelativePath(event.filePath, repoPath));
          return;
        }
        case "git-state-changed":
          invalidateGitBranchQueries(repoPath);
          return;
        case "working-tree-changed":
          invalidateGitWorkingTreeQueries(repoPath);
          return;
      }
    },
    [repoPath, taskId, queryClient, trpc, closeTabsForFile],
  );

  useFileWatcherUI(repoPath, onEvent);
}
