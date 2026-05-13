import { TaskLogsPanel } from "@features/task-detail/components/TaskLogsPanel";
import { useTasks } from "@features/tasks/hooks/useTasks";
import { LightbulbIcon } from "@phosphor-icons/react";
import { Box, Flex, Spinner, Text } from "@radix-ui/themes";
import { useNavigationStore } from "@stores/navigationStore";
import { useWorkSkillsStore } from "@stores/workSkillsStore";

export function WorkSkillDetailView() {
  const selectedSkillId = useNavigationStore((s) => s.workSelectedSkillId);
  const navigateToWorkHome = useNavigationStore((s) => s.navigateToWorkHome);

  const skill = useWorkSkillsStore((s) =>
    selectedSkillId ? s.getSkill(selectedSkillId) : undefined,
  );

  const { data: tasks } = useTasks(undefined, { enabled: !!skill?.taskId });
  const task = skill?.taskId
    ? tasks?.find((t) => t.id === skill.taskId)
    : undefined;

  if (!skill) {
    navigateToWorkHome();
    return null;
  }

  if (skill.isSeed) {
    return (
      <Flex
        direction="column"
        align="center"
        justify="center"
        className="h-full w-full"
        px="4"
      >
        <Box className="w-full max-w-[560px]">
          <Flex align="center" gap="2" mb="3">
            <LightbulbIcon size={20} weight="fill" />
            <Text
              as="div"
              weight="medium"
              className="text-(--gray-12) text-[18px]"
            >
              {skill.name}
            </Text>
          </Flex>
          <Box className="rounded-(--radius-3) border border-(--gray-5) bg-(--color-panel-solid) p-4">
            <Text
              as="div"
              className="text-(--gray-10) text-[11px] uppercase tracking-wide"
            >
              What this skill does
            </Text>
            <Text as="div" mt="2" className="text-(--gray-12) text-[14px]">
              {skill.prompt}
            </Text>
          </Box>
          <Text
            as="div"
            mt="3"
            className="text-center text-(--gray-10) text-[12px]"
          >
            This is an example skill. Create your own with "New skill".
          </Text>
        </Box>
      </Flex>
    );
  }

  if (!skill.taskId || !task) {
    return (
      <Flex align="center" justify="center" gap="2" className="h-full w-full">
        <Spinner size="2" />
        <Text className="text-(--gray-11) text-[13px]">
          Starting skill generation…
        </Text>
      </Flex>
    );
  }

  return <TaskLogsPanel taskId={task.id} task={task} />;
}
