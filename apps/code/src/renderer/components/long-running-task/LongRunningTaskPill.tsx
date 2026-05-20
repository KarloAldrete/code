import { StopCircleIcon } from "@phosphor-icons/react";
import { Box, Flex, IconButton, Text, Tooltip } from "@radix-ui/themes";
import { trpcClient } from "@renderer/trpc/client";
import { useLongRunningTaskStore } from "@stores/longRunningTaskStore";
import { logger } from "@utils/logger";
import { toast } from "@utils/toast";
import { useCallback } from "react";

const log = logger.scope("long-running-task-pill");

interface LongRunningTaskPillProps {
  taskRunId: string;
}

export function LongRunningTaskPill({ taskRunId }: LongRunningTaskPillProps) {
  const task = useLongRunningTaskStore((s) => s.byTaskRunId[taskRunId]);

  const stopLoop = useCallback(async () => {
    try {
      await trpcClient.agent.stopLongRunningTask.mutate({
        sessionId: taskRunId,
      });
      toast.success("Long-running task stopped");
    } catch (err) {
      log.error("Failed to stop long-running task", { err });
      toast.error("Failed to stop long-running task");
    }
  }, [taskRunId]);

  if (!task?.active) return null;

  return (
    <Box className="rounded-md border border-iris-6 bg-iris-2 px-3 py-2">
      <Flex align="center" gap="3" justify="between">
        <Flex align="center" gap="2" className="min-w-0">
          <Text size="1" weight="medium" className="shrink-0 text-iris-11">
            Long-running task
          </Text>
          <Text size="1" className="shrink-0 text-iris-11">
            • {task.iterations}/{task.maxIterations}
          </Text>
          {task.goal && (
            <Tooltip content={task.goal}>
              <Text size="1" truncate className="min-w-0 text-iris-12">
                • {task.goal}
              </Text>
            </Tooltip>
          )}
        </Flex>
        <Tooltip content="Stop the auto-continuation loop. Current turn finishes normally.">
          <IconButton
            size="1"
            variant="ghost"
            color="iris"
            onClick={stopLoop}
            aria-label="Stop long-running task"
          >
            <StopCircleIcon size={16} />
          </IconButton>
        </Tooltip>
      </Flex>
    </Box>
  );
}
