import { resolveChatDir } from "@features/chat/hooks/useChatDir";
import { getSessionService } from "@features/sessions/service/service";
import { useSessionStore } from "@features/sessions/stores/sessionStore";
import { useTasks } from "@features/tasks/hooks/useTasks";
import type { Task } from "@shared/types";
import { useNavigationStore } from "@stores/navigationStore";
import { useProjectChatsStore } from "@stores/projectChatsStore";
import { logger } from "@utils/logger";
import { useEffect, useMemo } from "react";
import { useWorkProjects } from "../canvas/useProjectCanvas";

const log = logger.scope("project-chat-prewarmer");

/** How many project chats to keep warm at any one time. */
const MAX_PREWARMED = 3;

/** How long a warm session can sit unvisited before we tear it down. */
const IDLE_DISCONNECT_MS = 10 * 60 * 1000;

/** Module-level registry shared across remounts of the hook. Keys are
 * `projectId`. We store the warmed `taskId` (so we can disconnect the
 * correct session) and the idle timer handle. */
interface WarmEntry {
  taskId: string;
  idleTimer: ReturnType<typeof setTimeout> | null;
}
const warmRegistry = new Map<string, WarmEntry>();

function clearIdleTimer(entry: WarmEntry): void {
  if (entry.idleTimer) {
    clearTimeout(entry.idleTimer);
    entry.idleTimer = null;
  }
}

function scheduleIdleDisconnect(projectId: string): void {
  const entry = warmRegistry.get(projectId);
  if (!entry) return;
  clearIdleTimer(entry);
  entry.idleTimer = setTimeout(() => {
    const isFocused =
      useNavigationStore.getState().workSelectedProjectId === projectId;
    if (isFocused) return;
    const current = warmRegistry.get(projectId);
    if (!current) return;
    log.info("Idle-disconnecting prewarmed project chat", {
      projectId,
      taskId: current.taskId,
    });
    void getSessionService().disconnectFromTask(current.taskId);
    warmRegistry.delete(projectId);
  }, IDLE_DISCONNECT_MS);
}

function evictProject(projectId: string): void {
  const entry = warmRegistry.get(projectId);
  if (!entry) return;
  clearIdleTimer(entry);
  log.info("Evicting prewarmed project chat", {
    projectId,
    taskId: entry.taskId,
  });
  void getSessionService().disconnectFromTask(entry.taskId);
  warmRegistry.delete(projectId);
}

function alreadyConnectedOrConnecting(taskId: string): boolean {
  const state = useSessionStore.getState();
  const taskRunId = state.taskIdIndex[taskId];
  if (!taskRunId) return false;
  const session = state.sessions[taskRunId];
  if (!session) return false;
  return session.status === "connected" || session.status === "connecting";
}

async function warmProject(projectId: string, task: Task): Promise<void> {
  try {
    const repoPath = await resolveChatDir(task.id);
    if (!warmRegistry.has(projectId)) return;
    await getSessionService().connectToTask({
      task,
      repoPath,
      isChat: true,
    });
  } catch (error) {
    log.warn("Failed to prewarm project chat", { projectId, error });
    warmRegistry.delete(projectId);
  }
}

/**
 * Speculatively connects the top recent/pinned project chats in the
 * background so that when the user clicks into one it is already live.
 *
 * Mount once high in the Business surface (WorkView). Keeps at most
 * {@link MAX_PREWARMED} sessions warm. Sessions idle longer than
 * {@link IDLE_DISCONNECT_MS} without being focused are disconnected.
 */
export function useProjectChatPrewarmer(): void {
  const { data: projects } = useWorkProjects();
  const { data: tasks } = useTasks();
  const chatIdByProjectId = useProjectChatsStore((s) => s.chatIdByProjectId);
  const workSelectedProjectId = useNavigationStore(
    (s) => s.workSelectedProjectId,
  );

  const candidates = useMemo<string[]>(() => {
    const list = projects ?? [];
    return [...list]
      .sort((a, b) => {
        const aKey = new Date(a.pinnedAt ?? a.updatedAt).getTime();
        const bKey = new Date(b.pinnedAt ?? b.updatedAt).getTime();
        return bKey - aKey;
      })
      .slice(0, MAX_PREWARMED)
      .map((p) => p.id)
      .filter((id) => !!chatIdByProjectId[id]);
  }, [projects, chatIdByProjectId]);

  useEffect(() => {
    const desired = new Set(candidates);

    for (const projectId of Array.from(warmRegistry.keys())) {
      if (!desired.has(projectId)) {
        evictProject(projectId);
      }
    }

    for (const projectId of candidates) {
      if (warmRegistry.has(projectId)) continue;
      const taskId = chatIdByProjectId[projectId];
      if (!taskId) continue;
      const task = tasks?.find((t) => t.id === taskId);
      if (!task) continue;
      if (alreadyConnectedOrConnecting(taskId)) continue;

      warmRegistry.set(projectId, { taskId, idleTimer: null });
      void warmProject(projectId, task);
      scheduleIdleDisconnect(projectId);
    }
  }, [candidates, tasks, chatIdByProjectId]);

  // Reset the idle timer for the focused project so visiting it counts
  // as fresh activity.
  useEffect(() => {
    if (!workSelectedProjectId) return;
    if (warmRegistry.has(workSelectedProjectId)) {
      scheduleIdleDisconnect(workSelectedProjectId);
    }
  }, [workSelectedProjectId]);
}
