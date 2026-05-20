interface HandlePlanDeletionArgs {
  deletedPath: string;
  currentPath: string | null;
  clearCache: () => void;
  onCleared: () => void;
}

/**
 * When the plans watcher reports that a plan file was deleted, clear the
 * cached read for that path so a stale render doesn't persist after the
 * file disappears. No-op when the deleted file isn't the one currently
 * being viewed.
 */
export function handlePlanDeletion({
  deletedPath,
  currentPath,
  clearCache,
  onCleared,
}: HandlePlanDeletionArgs): void {
  if (!currentPath) return;
  if (deletedPath !== currentPath) return;
  clearCache();
  onCleared();
}
