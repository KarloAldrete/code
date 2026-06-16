import type {
  AvailableCommand,
  SessionConfigOption,
} from "@agentclientprotocol/sdk";
import {
  extractAvailableCommandsFromEvents,
  extractUserPromptsFromEvents,
} from "@posthog/core/sessions/sessionEvents";
import type { PermissionRequest } from "@posthog/ui/features/sessions/sessionLogTypes";
import { shallow } from "zustand/shallow";
import {
  type Adapter,
  type AgentSession,
  getConfigOptionByCategory,
  type OptimisticItem,
  type QueuedMessage,
  useSessionStore,
} from "./sessionStore";

export const useSessions = () => useSessionStore((s) => s.sessions);

/** The live session-derived status a single sidebar row displays. */
export interface SidebarTaskStatus {
  isGenerating: boolean;
  needsPermission: boolean;
  taskRunStatus: AgentSession["cloudStatus"];
  cloudPrUrl: string | null;
}

/**
 * The live status for one task's row, subscribed per-row. Returns only the
 * primitive fields a row renders, compared with `shallow` — so a streaming
 * token (which only mutates `session.events`) produces an equal object and
 * doesn't re-render the row, and nothing above it. The list itself is built
 * from tasks alone (see useSidebarData), so it never touches this store.
 */
export const useSidebarStatusForTask = (
  taskId: string,
): SidebarTaskStatus | null =>
  useSessionStore((s) => {
    const taskRunId = s.taskIdIndex[taskId];
    if (!taskRunId) return null;
    const session = s.sessions[taskRunId];
    if (!session) return null;
    return {
      isGenerating: session.isPromptPending,
      needsPermission: session.pendingPermissions.size > 0,
      taskRunStatus: session.cloudStatus,
      cloudPrUrl:
        typeof session.cloudOutput?.pr_url === "string"
          ? session.cloudOutput.pr_url
          : null,
    };
  }, shallow);

/** O(1) lookup using taskIdIndex */
export const useSessionForTask = (
  taskId: string | undefined,
): AgentSession | undefined =>
  useSessionStore((s) => {
    if (!taskId) return undefined;
    const taskRunId = s.taskIdIndex[taskId];
    if (!taskRunId) return undefined;
    return s.sessions[taskRunId];
  });

/**
 * Returns `null` when the agent hasn't sent an `available_commands_update` yet,
 * so callers can distinguish that from an explicit empty list.
 */
export function getAvailableCommandsForTask(
  taskId: string | undefined,
): AvailableCommand[] | null {
  if (!taskId) return null;
  const state = useSessionStore.getState();
  const taskRunId = state.taskIdIndex[taskId];
  if (!taskRunId) return null;
  const session = state.sessions[taskRunId];
  if (!session?.events) return null;
  return extractAvailableCommandsFromEvents(session.events);
}

export function getUserPromptsForTask(taskId: string | undefined): string[] {
  if (!taskId) return [];
  const state = useSessionStore.getState();
  const taskRunId = state.taskIdIndex[taskId];
  if (!taskRunId) return [];
  const session = state.sessions[taskRunId];
  if (!session?.events) return [];
  return extractUserPromptsFromEvents(session.events);
}

export const usePendingPermissionsForTask = (
  taskId: string | undefined,
): Map<string, PermissionRequest> => {
  return useSessionStore((s) => {
    if (!taskId) return new Map();
    const taskRunId = s.taskIdIndex[taskId];
    if (!taskRunId) return new Map();
    const session = s.sessions[taskRunId];
    return session?.pendingPermissions ?? new Map();
  }, shallow);
};

export function getPendingPermissionsForTask(
  taskId: string | undefined,
): Map<string, PermissionRequest> {
  if (!taskId) return new Map();
  const state = useSessionStore.getState();
  const taskRunId = state.taskIdIndex[taskId];
  if (!taskRunId) return new Map();
  const session = state.sessions[taskRunId];
  return session?.pendingPermissions ?? new Map();
}

export const useQueuedMessagesForTask = (
  taskId: string | undefined,
): QueuedMessage[] => {
  return useSessionStore((s) => {
    if (!taskId) return [];
    const taskRunId = s.taskIdIndex[taskId];
    if (!taskRunId) return [];
    const session = s.sessions[taskRunId];
    return session?.messageQueue ?? [];
  }, shallow);
};

export const useOptimisticItemsForTask = (
  taskId: string | undefined,
): OptimisticItem[] => {
  return useSessionStore((s) => {
    if (!taskId) return [];
    const taskRunId = s.taskIdIndex[taskId];
    if (!taskRunId) return [];
    return s.sessions[taskRunId]?.optimisticItems ?? [];
  }, shallow);
};

// --- Config Option Hooks ---

/** Get a config option by category for a task */
export const useConfigOptionForTask = (
  taskId: string | undefined,
  category: string,
): SessionConfigOption | undefined => {
  return useSessionStore((s) => {
    if (!taskId) return undefined;
    const taskRunId = s.taskIdIndex[taskId];
    if (!taskRunId) return undefined;
    const session = s.sessions[taskRunId];
    return getConfigOptionByCategory(session?.configOptions, category);
  });
};

/** Get the mode config option for a task */
export const useModeConfigOptionForTask = (
  taskId: string | undefined,
): SessionConfigOption | undefined => {
  return useConfigOptionForTask(taskId, "mode");
};

/** Get the model config option for a task */
export const useModelConfigOptionForTask = (
  taskId: string | undefined,
): SessionConfigOption | undefined => {
  return useConfigOptionForTask(taskId, "model");
};

/** Get the thought level config option for a task */
export const useThoughtLevelConfigOptionForTask = (
  taskId: string | undefined,
): SessionConfigOption | undefined => {
  return useConfigOptionForTask(taskId, "thought_level");
};

/** Get the adapter type for a task */
export const useAdapterForTask = (
  taskId: string | undefined,
): Adapter | undefined => {
  return useSessionStore((s) => {
    if (!taskId) return undefined;
    const taskRunId = s.taskIdIndex[taskId];
    if (!taskRunId) return undefined;
    return s.sessions[taskRunId]?.adapter;
  });
};
