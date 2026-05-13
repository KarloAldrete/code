import { SidebarItem } from "@features/sidebar/components/SidebarItem";
import { LightbulbIcon, PlusIcon } from "@phosphor-icons/react";
import { Box, Flex, ScrollArea, Text } from "@radix-ui/themes";
import { useNavigationStore } from "@stores/navigationStore";
import { useWorkSkillsStore } from "@stores/workSkillsStore";

export function WorkSidebarMenu() {
  const skills = useWorkSkillsStore((s) => s.skills);
  const workView = useNavigationStore((s) => s.workView);
  const selectedSkillId = useNavigationStore((s) => s.workSelectedSkillId);
  const navigateToWorkGenerate = useNavigationStore(
    (s) => s.navigateToWorkGenerate,
  );
  const navigateToWorkSkill = useNavigationStore((s) => s.navigateToWorkSkill);

  const isGenerateActive = workView === "generate";

  return (
    <Box height="100%" position="relative">
      <ScrollArea className="h-full overflow-y-auto overflow-x-hidden">
        <Flex direction="column" py="2" px="2" gap="1px">
          <Box mb="2">
            <SidebarItem
              depth={0}
              icon={<PlusIcon size={16} weight="bold" />}
              label="New skill"
              isActive={isGenerateActive}
              onClick={navigateToWorkGenerate}
            />
          </Box>

          {skills.length > 0 && (
            <Box px="2" pt="1" pb="1">
              <Text
                as="div"
                className="font-medium text-(--gray-10) text-[11px] uppercase tracking-wide"
              >
                Skills
              </Text>
            </Box>
          )}

          {skills.map((skill) => (
            <Box key={skill.id}>
              <SidebarItem
                depth={0}
                icon={
                  <LightbulbIcon
                    size={16}
                    weight={
                      selectedSkillId === skill.id &&
                      workView === "skill-detail"
                        ? "fill"
                        : "regular"
                    }
                  />
                }
                label={skill.name}
                isActive={
                  selectedSkillId === skill.id && workView === "skill-detail"
                }
                onClick={() => navigateToWorkSkill(skill.id)}
              />
            </Box>
          ))}
        </Flex>
      </ScrollArea>
    </Box>
  );
}
