/**
 * PostHog-specific ACP extensions.
 *
 * These follow the ACP extensibility model:
 * - Custom notification methods are prefixed with `_posthog/`
 * - Custom data can be attached via `_meta` fields
 *
 * See: https://agentclientprotocol.com/docs/extensibility
 */

/**
 * Custom notification methods for PostHog-specific events.
 * Used with AgentSideConnection.extNotification() or Client.extNotification()
 */
export const POSTHOG_NOTIFICATIONS = {
  /** Git branch was created for a task */
  BRANCH_CREATED: "_posthog/branch_created",

  /** Task run has started execution */
  RUN_STARTED: "_posthog/run_started",

  /** Task has completed (success or failure) */
  TASK_COMPLETE: "_posthog/task_complete",

  /** Agent finished processing a turn (prompt returned, waiting for next input) */
  TURN_COMPLETE: "_posthog/turn_complete",

  /** Error occurred during task execution */
  ERROR: "_posthog/error",

  /** Console/log output from the agent */
  CONSOLE: "_posthog/console",

  /** Maps taskRunId to agent's sessionId and adapter type (for resumption) */
  SDK_SESSION: "_posthog/sdk_session",

  /** Git checkpoint captured for handoff */
  GIT_CHECKPOINT: "_posthog/git_checkpoint",

  /** Agent mode changed (interactive/background) */
  MODE_CHANGE: "_posthog/mode_change",

  /** Request to resume a session from previous state */
  SESSION_RESUME: "_posthog/session/resume",

  /** User message sent from client to agent */
  USER_MESSAGE: "_posthog/user_message",

  /** Request to cancel current operation */
  CANCEL: "_posthog/cancel",

  /** Request to close the session */
  CLOSE: "_posthog/close",

  /** Agent status update (thinking, working, etc.) */
  STATUS: "_posthog/status",

  /** Structured backend progress notification; events in the same turn group into one card on the client */
  PROGRESS: "_posthog/progress",

  /** Task-level notification (progress, milestones) */
  TASK_NOTIFICATION: "_posthog/task_notification",

  /** Marks a boundary for log compaction */
  COMPACT_BOUNDARY: "_posthog/compact_boundary",

  /** Token usage update for a session turn */
  USAGE_UPDATE: "_posthog/usage_update",

  /** Response to a relayed permission request (plan approval, question) */
  PERMISSION_RESPONSE: "_posthog/permission_response",

  /**
   * Long-running-task state changed (entered, iteration advanced, exited).
   * Payload: { active, goal, successCriterion, marker, iterations, maxIterations }
   */
  LONG_RUNNING_TASK_UPDATE: "_posthog/long_running_task_update",

  /**
   * Agent emitted a long-running-task proposal in its end-of-turn message.
   * Payload: { proposalId, goal, successCriterion, marker, maxIterations, approach }
   * The client should render a confirmation card and call START_LONG_RUNNING_TASK
   * (plus send a kickoff prompt) when the user approves.
   */
  LONG_RUNNING_TASK_PROPOSAL: "_posthog/long_running_task_proposal",
} as const;

/**
 * Custom request methods for PostHog-specific operations that need a response
 * (request/response, not fire-and-forget). Used with
 * ClientSideConnection.extMethod() on the sender and Agent.extMethod() on the
 * receiver.
 */
export const POSTHOG_METHODS = {
  /**
   * Client requests a session refresh between turns. Payload may include
   * `mcpServers` to trigger a resume-with-new-options reinit; future fields
   * can extend this without adding new methods. Returns once the refresh has
   * completed so the caller can safely send the next prompt.
   */
  REFRESH_SESSION: "_posthog/refresh_session",

  /**
   * Begin a long-running task on this session. The next prompt() call will
   * loop after each end_turn until the agent emits `marker` in its last
   * assistant text, the iteration cap is hit, or the user stops the loop.
   * Payload: { goal, successCriterion, marker, maxIterations }
   */
  START_LONG_RUNNING_TASK: "_posthog/long_running_task/start",

  /**
   * Stop the active long-running task on this session. The current turn
   * finishes naturally — no auto-continuation will be injected after it.
   */
  STOP_LONG_RUNNING_TASK: "_posthog/long_running_task/stop",
} as const;

type PosthogNotification =
  (typeof POSTHOG_NOTIFICATIONS)[keyof typeof POSTHOG_NOTIFICATIONS];

type PosthogMethod = (typeof POSTHOG_METHODS)[keyof typeof POSTHOG_METHODS];

/**
 * Does `method` match `expected`? Shared by notification and method matchers.
 * Handles the `__posthog/` double-prefix that extNotification() can produce.
 */
function matchesExt(method: string | undefined, expected: string): boolean {
  if (!method) return false;
  return method === expected || method === `_${expected}`;
}

/** Dispatcher check for incoming `extNotification` calls on the agent side. */
export function isNotification(
  method: string | undefined,
  expected: PosthogNotification,
): boolean {
  return matchesExt(method, expected);
}

/** Dispatcher check for incoming `extMethod` calls on the agent side. */
export function isMethod(
  method: string | undefined,
  expected: PosthogMethod,
): boolean {
  return matchesExt(method, expected);
}
