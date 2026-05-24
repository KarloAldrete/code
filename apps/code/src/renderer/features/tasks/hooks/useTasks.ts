import { pinnedTasksApi } from "@features/sidebar/hooks/usePinnedTasks";
import { workspaceApi } from "@features/workspace/hooks/useWorkspace";
import { useAuthenticatedMutation } from "@hooks/useAuthenticatedMutation";
import { useAuthenticatedQuery } from "@hooks/useAuthenticatedQuery";
import { useMeQuery } from "@hooks/useMeQuery";
import type { Schemas } from "@renderer/api/generated";
import { useFocusStore } from "@renderer/stores/focusStore";
import { useNavigationStore } from "@renderer/stores/navigationStore";
import { useRendererWindowFocusStore } from "@renderer/stores/rendererWindowFocusStore";
import { trpcClient } from "@renderer/trpc/client";
import type { Task } from "@shared/types";
import { keepPreviousData, useQueryClient } from "@tanstack/react-query";
import { logger } from "@utils/logger";
import { useCallback, useEffect, useRef } from "react";

const log = logger.scope("tasks");

// Polling resets to MIN on focus return, doubles toward MAX while focused, and
// pauses entirely while blurred. The 5-minute global staleTime means
// refetchOnWindowFocus is unreliable for surfacing tasks created elsewhere
// (e.g. on mobile), so we drive the refresh on focus explicitly.
export const TASK_LIST_POLL_MIN_MS = 30_000;
export const TASK_LIST_POLL_MAX_MS = 3 * 60_000;

function useAdaptiveTaskListPolling(
  queryKey: readonly unknown[],
): () => number | false {
  const focused = useRendererWindowFocusStore((s) => s.focused);
  const queryClient = useQueryClient();
  const intervalRef = useRef(TASK_LIST_POLL_MIN_MS);
  const previousFocusedRef = useRef(focused);
  const queryKeyRef = useRef(queryKey);
  queryKeyRef.current = queryKey;

  useEffect(() => {
    const wasFocused = previousFocusedRef.current;
    previousFocusedRef.current = focused;
    if (focused && !wasFocused) {
      intervalRef.current = TASK_LIST_POLL_MIN_MS;
      queryClient.invalidateQueries({ queryKey: queryKeyRef.current });
    }
  }, [focused, queryClient]);

  return useCallback((): number | false => {
    if (!focused) return false;
    const next = intervalRef.current;
    intervalRef.current = Math.min(next * 2, TASK_LIST_POLL_MAX_MS);
    return next;
  }, [focused]);
}

const taskKeys = {
  all: ["tasks"] as const,
  lists: () => [...taskKeys.all, "list"] as const,
  list: (filters?: {
    repository?: string;
    createdBy?: number;
    originProduct?: string;
    internal?: boolean;
  }) => [...taskKeys.lists(), filters] as const,
  summaries: (ids: string[]) =>
    [...taskKeys.all, "summaries", [...ids].sort()] as const,
  details: () => [...taskKeys.all, "detail"] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

export function useTasks(
  filters?: {
    repository?: string;
    showAllUsers?: boolean;
    showInternal?: boolean;
  },
  options?: { enabled?: boolean },
) {
  const { data: currentUser } = useMeQuery();
  const createdBy = filters?.showAllUsers ? undefined : currentUser?.id;
  const internal = filters?.showInternal ? true : undefined;

  const queryKey = taskKeys.list({
    repository: filters?.repository,
    createdBy,
    internal,
  });
  const refetchInterval = useAdaptiveTaskListPolling(queryKey);

  return useAuthenticatedQuery(
    queryKey,
    (client) =>
      client.getTasks({
        repository: filters?.repository,
        createdBy,
        internal,
      }) as unknown as Promise<Task[]>,
    {
      enabled: (options?.enabled ?? true) && !!currentUser?.id,
      refetchInterval,
      refetchIntervalInBackground: false,
    },
  );
}

export function useTaskSummaries(
  ids: string[],
  options?: { enabled?: boolean },
) {
  const queryKey = taskKeys.summaries(ids);
  const refetchInterval = useAdaptiveTaskListPolling(queryKey);

  return useAuthenticatedQuery<Schemas.TaskSummary[]>(
    queryKey,
    (client) => client.getTaskSummaries(ids),
    {
      enabled: (options?.enabled ?? true) && ids.length > 0,
      refetchInterval,
      refetchIntervalInBackground: false,
      placeholderData: keepPreviousData,
    },
  );
}

// The /tasks/summaries/ endpoint doesn't include origin_product, so fetch the
// slack-origin subset separately and intersect by id in the sidebar. The
// `internal` filter mirrors the sidebar's task-visibility scope so staff
// toggling the internal view still see slack icons on internal tasks.
export function useSlackTasks(options?: {
  enabled?: boolean;
  showInternal?: boolean;
}) {
  const internal = options?.showInternal ? true : undefined;
  const queryKey = taskKeys.list({ originProduct: "slack", internal });
  const refetchInterval = useAdaptiveTaskListPolling(queryKey);

  return useAuthenticatedQuery<Task[]>(
    queryKey,
    (client) =>
      client.getTasks({
        originProduct: "slack",
        internal,
      }) as unknown as Promise<Task[]>,
    {
      enabled: options?.enabled ?? true,
      refetchInterval,
      refetchIntervalInBackground: false,
    },
  );
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  const invalidateTasks = (newTask?: Task) => {
    if (newTask) {
      queryClient.setQueriesData<Task[]>(
        { queryKey: taskKeys.lists() },
        (old) => {
          if (!old) return old;
          if (old.some((task) => task.id === newTask.id)) return old;
          return [newTask, ...old];
        },
      );
    }
    queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
  };

  const mutation = useAuthenticatedMutation(
    (
      client,
      {
        description,
        repository,
        github_integration,
      }: {
        description: string;
        repository?: string;
        github_integration?: number;
        createdFrom?: "cli" | "command-menu";
      },
    ) =>
      client.createTask({
        description,
        repository,
        github_integration,
      }) as unknown as Promise<Task>,
  );

  return { ...mutation, invalidateTasks };
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useAuthenticatedMutation(
    (
      client,
      {
        taskId,
        updates,
      }: {
        taskId: string;
        updates: Partial<Task>;
      },
    ) =>
      client.updateTask(
        taskId,
        updates as Parameters<typeof client.updateTask>[1],
      ),
    {
      onSuccess: (_, { taskId }) => {
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
        queryClient.invalidateQueries({ queryKey: taskKeys.detail(taskId) });
        queryClient.invalidateQueries({
          queryKey: [...taskKeys.all, "summaries"],
        });
      },
    },
  );
}

interface DeleteTaskOptions {
  taskId: string;
  taskTitle: string;
  hasWorktree: boolean;
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { view, navigateToTaskInput } = useNavigationStore();

  const mutation = useAuthenticatedMutation(
    async (client, taskId: string) => {
      const focusStore = useFocusStore.getState();
      const workspace = await workspaceApi.get(taskId);

      if (workspace) {
        if (
          focusStore.session?.worktreePath === workspace.worktreePath &&
          workspace.worktreePath
        ) {
          log.info("Unfocusing workspace before deletion");
          await focusStore.disableFocus();
        }

        try {
          await workspaceApi.delete(taskId, workspace.folderPath);
        } catch (error) {
          log.error("Failed to delete workspace:", error);
        }
      }

      return client.deleteTask(taskId);
    },
    {
      onMutate: async (taskId) => {
        // Cancel outgoing refetches to avoid overwriting optimistic update
        await queryClient.cancelQueries({ queryKey: taskKeys.lists() });

        // Snapshot all task list queries for rollback
        const previousQueries: Array<{ queryKey: unknown; data: Task[] }> = [];
        const queries = queryClient.getQueriesData<Task[]>({
          queryKey: taskKeys.lists(),
        });
        for (const [queryKey, data] of queries) {
          if (data) {
            previousQueries.push({ queryKey, data });
          }
        }

        // Optimistically remove the task from all list queries
        queryClient.setQueriesData<Task[]>(
          { queryKey: taskKeys.lists() },
          (old) => old?.filter((task) => task.id !== taskId),
        );

        return { previousQueries };
      },
      onError: (_err, _taskId, context) => {
        // Rollback all queries on error
        const ctx = context as
          | {
              previousQueries: Array<{
                queryKey: readonly unknown[];
                data: Task[];
              }>;
            }
          | undefined;
        if (ctx?.previousQueries) {
          for (const { queryKey, data } of ctx.previousQueries) {
            queryClient.setQueryData(queryKey, data);
          }
        }
      },
      onSettled: () => {
        // Always refetch to ensure sync with server
        queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      },
    },
  );

  const deleteWithConfirm = useCallback(
    async ({ taskId, taskTitle, hasWorktree }: DeleteTaskOptions) => {
      const result = await trpcClient.contextMenu.confirmDeleteTask.mutate({
        taskTitle,
        hasWorktree,
      });

      if (!result.confirmed) {
        return false;
      }

      // Navigate away if viewing the deleted task
      if (view.type === "task-detail" && view.data?.id === taskId) {
        navigateToTaskInput();
      }

      pinnedTasksApi.unpin(taskId);

      await mutation.mutateAsync(taskId);

      return true;
    },
    [mutation, view, navigateToTaskInput],
  );

  return { ...mutation, deleteWithConfirm };
}
