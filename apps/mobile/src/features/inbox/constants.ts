/** Comma-separated statuses for the inbox pipeline (excludes terminal/deleted). */
export const INBOX_PIPELINE_STATUS_FILTER =
  "potential,candidate,in_progress,ready,pending_input";

/** Polling interval for inbox queries (ms). */
export const INBOX_REFETCH_INTERVAL_MS = 5_000;
