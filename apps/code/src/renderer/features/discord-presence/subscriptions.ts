import {
  sessionStoreSetters,
  useSessionStore,
} from "@features/sessions/stores/sessionStore";
import { getAppViewSnapshot } from "@hooks/useAppView";
import type { PresenceIntent } from "@main/services/discord-presence/schemas";
import { subscribeToRouterResolved } from "@renderer/navigationBridge";
import { trpcClient } from "@renderer/trpc/client";
import { logger } from "@utils/logger";
import { getCachedTask } from "@utils/queryClient";

const log = logger.scope("discord-presence");

/**
 * Derive the high-level presence intent from renderer UI state. "What the user
 * is looking at" is genuinely renderer-owned (the current route + session), so
 * we compute it here and hand a small validated payload to the main service,
 * which owns the connection and the privacy-aware formatting.
 */
function computeIntent(): PresenceIntent {
  const view = getAppViewSnapshot();
  const taskId = view.type === "task-detail" ? view.taskId : undefined;
  // The router only carries the taskId; resolve title/repo from cached tasks.
  const task = taskId ? getCachedTask(taskId) : undefined;

  let agentRunning = false;
  if (taskId) {
    const session = sessionStoreSetters.getSessionByTaskId(taskId);
    agentRunning = session?.isPromptPending ?? false;
  }

  return {
    hasActiveTask: Boolean(taskId),
    taskTitle: task?.title ?? null,
    repoName: task?.repository ?? null,
    agentRunning,
  };
}

// Last payload we sent, to avoid spamming the service with no-op updates as the
// route/session churn. The main service additionally rate-limits before it
// reaches Discord.
let lastSent = "";

function push(): void {
  const intent = computeIntent();
  const key = JSON.stringify(intent);
  if (key === lastSent) return;
  lastSent = key;
  trpcClient.discordPresence.setActivity.mutate(intent).catch((error) => {
    log.warn("Failed to update Discord presence", { error });
  });
}

/**
 * Wire presence updates to route and session changes. Started once at app boot;
 * returns a cleanup that detaches the subscriptions.
 */
export function registerDiscordPresenceSubscriptions(): () => void {
  push();
  const unsubscribeRouter = subscribeToRouterResolved(push);
  const unsubscribeSession = useSessionStore.subscribe(push);
  return () => {
    unsubscribeRouter();
    unsubscribeSession();
    lastSent = "";
  };
}
