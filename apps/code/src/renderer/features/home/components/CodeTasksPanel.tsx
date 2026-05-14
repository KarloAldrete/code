import { useTasks } from "@features/tasks/hooks/useTasks";
import { Box, Flex, Text } from "@radix-ui/themes";
import { useNavigationStore } from "@stores/navigationStore";
import { formatRelativeTimeShort } from "@utils/time";

export function CodeTasksPanel() {
  const { data: tasks = [], isLoading } = useTasks();
  const navigateToTask = useNavigationStore((s) => s.navigateToTask);

  return (
    <Flex
      direction="column"
      className="h-full w-70 shrink-0 border-(--gray-5) border-l bg-(--gray-1)"
    >
      <Box className="shrink-0 border-(--gray-5) border-b px-3 py-2">
        <Text size="2" weight="medium" className="text-(--gray-12)">
          All tasks
        </Text>
      </Box>
      <Box className="flex-1 overflow-y-auto">
        {isLoading ? (
          <Box className="px-3 py-2">
            <Text size="1" className="text-(--gray-10)">
              Loading…
            </Text>
          </Box>
        ) : tasks.length === 0 ? (
          <Box className="px-3 py-2">
            <Text size="1" className="text-(--gray-10)">
              No tasks yet
            </Text>
          </Box>
        ) : (
          <Flex direction="column">
            {tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => navigateToTask(task)}
                className="flex flex-col gap-0.5 border-(--gray-4) border-b px-3 py-2 text-left transition-colors hover:bg-(--gray-3)"
              >
                <Text
                  size="2"
                  className="line-clamp-2 text-(--gray-12)"
                  title={task.title}
                >
                  {task.title || "Untitled task"}
                </Text>
                <Text size="1" className="text-(--gray-10)">
                  {formatRelativeTimeShort(
                    new Date(task.updated_at ?? task.created_at).getTime(),
                  )}
                </Text>
              </button>
            ))}
          </Flex>
        )}
      </Box>
    </Flex>
  );
}
