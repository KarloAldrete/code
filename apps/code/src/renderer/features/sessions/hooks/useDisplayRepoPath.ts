import { useCwd } from "@features/sidebar/hooks/useCwd";
import { useTasks } from "@features/tasks/hooks/useTasks";
import { parseRepository } from "@utils/repository";

const REMOTE_WORKSPACE_PREFIX = "/tmp/workspace/repos";

export function useDisplayRepoPath(
  taskId: string | undefined,
): string | undefined {
  const localCwd = useCwd(taskId ?? "");
  const { data: tasks = [] } = useTasks();

  if (localCwd) return localCwd;
  if (!taskId) return undefined;

  const task = tasks.find((t) => t.id === taskId);
  const parsed = task?.repository ? parseRepository(task.repository) : null;
  if (!parsed) return undefined;

  return `${REMOTE_WORKSPACE_PREFIX}/${parsed.organization}/${parsed.repoName}`;
}
