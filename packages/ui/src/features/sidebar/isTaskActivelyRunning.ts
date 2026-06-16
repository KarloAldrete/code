import type { TaskData } from "@posthog/core/sidebar/sidebarData.types";
import { useSessionStore } from "../sessions/sessionStore";

/**
 * Live "is this task running?" check for event handlers (e.g. the archive
 * guard). Since the sidebar list no longer carries live session state in
 * `TaskData` (it's read per-row), this reads the session store imperatively:
 * a task is "running" if its live cloud status is in-progress or a prompt is
 * pending. Falls back to the task's API-level run status when no session.
 */
export function isTaskActivelyRunning(task: TaskData): boolean {
  const state = useSessionStore.getState();
  const taskRunId = state.taskIdIndex[task.id];
  const session = taskRunId ? state.sessions[taskRunId] : undefined;
  const runStatus = session?.cloudStatus ?? task.taskRunStatus;
  return runStatus === "in_progress" || (session?.isPromptPending ?? false);
}
