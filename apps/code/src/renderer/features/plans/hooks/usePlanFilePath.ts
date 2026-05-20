import { useSessionForTask } from "@features/sessions/hooks/useSession";
import { trpc } from "@renderer/trpc";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

/**
 * Returns the plan file path the agent is currently working on for this
 * task, or `null` if no plan has been produced.
 *
 * The path is owned by the main-process `AgentService`, which detects plan
 * file activity using the same `CLAUDE_CONFIG_DIR` env var that controls
 * where the watcher looks — so renderer and main process can never
 * disagree on which directory counts as the plans dir. Renderer never
 * inspects `rawInput` from tool calls directly.
 */
export function usePlanFilePath(taskId: string): string | null {
  const session = useSessionForTask(taskId);
  const taskRunId = session?.taskRunId ?? null;
  const queryClient = useQueryClient();

  const { data } = useQuery({
    ...trpc.agent.getPlanFilePath.queryOptions(
      { taskRunId: taskRunId ?? "" },
      { enabled: !!taskRunId, staleTime: 0 },
    ),
  });

  useSubscription(
    trpc.agent.onPlanFileChanged.subscriptionOptions(
      { taskRunId: taskRunId ?? "" },
      {
        enabled: !!taskRunId,
        onData: () => {
          if (!taskRunId) return;
          queryClient.invalidateQueries(
            trpc.agent.getPlanFilePath.queryFilter({ taskRunId }),
          );
        },
      },
    ),
  );

  return data ?? null;
}
