// Poll fast right after focus, then back off to 3 min. Tier thresholds are
// the cumulative elapsed time at which each tier finishes one tick, so each
// tier fires roughly once before promoting to the next.
export const TASK_LIST_POLL_MAX_MS = 3 * 60_000;

export function taskListPollInterval(elapsedSinceFocusMs: number): number {
  if (elapsedSinceFocusMs < 30_000) return 30_000;
  if (elapsedSinceFocusMs < 90_000) return 60_000;
  if (elapsedSinceFocusMs < 210_000) return 120_000;
  return TASK_LIST_POLL_MAX_MS;
}
