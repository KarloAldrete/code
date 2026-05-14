import { TaskDetail } from "@features/task-detail/components/TaskDetail";
import { useTasks } from "@features/tasks/hooks/useTasks";
import { Flex, Spinner } from "@radix-ui/themes";
import type { Task } from "@shared/types";
import { useNavigationStore } from "@stores/navigationStore";
import { useQueryClient } from "@tanstack/react-query";

export function WorkTaskDetailView() {
  const taskId = useNavigationStore((s) => s.workActiveTaskId);
  const { data: tasks } = useTasks();
  const queryClient = useQueryClient();

  // Prefer the list cache (kept up to date by polling). Fall back to the
  // per-task detail cache, which TaskService.createTask seeds the moment a new
  // task is created — that lets us render immediately on Run now without
  // waiting for the next list poll.
  const task: Task | undefined = taskId
    ? (tasks?.find((t) => t.id === taskId) ??
      queryClient.getQueryData<Task>(["tasks", "detail", taskId]))
    : undefined;

  if (!taskId) {
    return null;
  }

  if (!task) {
    return (
      <Flex align="center" justify="center" className="h-full w-full">
        <Spinner size="3" />
      </Flex>
    );
  }

  return <TaskDetail key={task.id} task={task} />;
}
