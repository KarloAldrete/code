import { useRendererWindowFocusStore } from "@renderer/stores/rendererWindowFocusStore";

export const TASK_LIST_FOCUSED_POLL_INTERVAL_MS = 3 * 60_000;

/**
 * Shared polling options for the three task-list queries (tasks,
 * summaries, slack tasks). Centralises two policy decisions:
 *
 * 1. Polling pauses when the document is hidden / window unfocused.
 * 2. On return to focus, force a refetch regardless of staleness — the
 *    global `staleTime` is 5 min, so `refetchOnWindowFocus: true` would
 *    silently skip the refetch in the exact window we care about
 *    (laptop opened after a short walk).
 */
export function useTaskListQueryOptions(): {
  refetchInterval: number | false;
  refetchOnWindowFocus: "always";
} {
  const focused = useRendererWindowFocusStore((s) => s.focused);
  return {
    refetchInterval: focused ? TASK_LIST_FOCUSED_POLL_INTERVAL_MS : false,
    refetchOnWindowFocus: "always",
  };
}
