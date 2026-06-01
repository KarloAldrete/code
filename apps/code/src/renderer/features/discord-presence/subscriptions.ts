import {
  sessionStoreSetters,
  useSessionStore,
} from "@features/sessions/stores/sessionStore";
import type { PresenceIntent } from "@main/services/discord-presence/schemas";
import { trpcClient } from "@renderer/trpc/client";
import { useNavigationStore } from "@stores/navigationStore";
import { logger } from "@utils/logger";

const log = logger.scope("discord-presence");

/**
 * Derive the high-level presence intent from renderer UI state. "What the user
 * is looking at" is genuinely renderer-owned (navigation + session), so we
 * compute it here and hand a small validated payload to the main service, which
 * owns the connection and the privacy-aware formatting.
 */
function computeIntent(): PresenceIntent {
  const { view } = useNavigationStore.getState();
  const task = view.type === "task-detail" ? view.data : undefined;

  let agentRunning = false;
  if (view.taskId) {
    const session = sessionStoreSetters.getSessionByTaskId(view.taskId);
    agentRunning = session?.isPromptPending ?? false;
  }

  return {
    hasActiveTask: Boolean(task),
    taskTitle: task?.title ?? null,
    repoName: task?.repository ?? null,
    agentRunning,
  };
}

// Last payload we sent, to avoid spamming the service with no-op updates as the
// stores churn. The main service additionally rate-limits before it reaches
// Discord.
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
 * Wire presence updates to navigation and session changes. Started once at app
 * boot; returns a cleanup that detaches the store subscriptions.
 */
export function registerDiscordPresenceSubscriptions(): () => void {
  push();
  const unsubscribeNavigation = useNavigationStore.subscribe(push);
  const unsubscribeSession = useSessionStore.subscribe(push);
  return () => {
    unsubscribeNavigation();
    unsubscribeSession();
    lastSent = "";
  };
}
