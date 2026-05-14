import { ChatCircleText } from "@phosphor-icons/react";
import { Flex, Text } from "@radix-ui/themes";
import type { WorkProject } from "@shared/types/work-projects";

interface ProjectChatEchoProps {
  project: WorkProject;
}

/**
 * Friendly fill shown inside a Business project chat while the agent is
 * connecting and no persisted events have streamed in yet. Replaces the
 * old full-screen spinner — keeps the conversation area calm and the
 * input fully interactive while the session warms up in the background.
 */
export function ProjectChatEcho({ project }: ProjectChatEchoProps) {
  return (
    <Flex
      align="center"
      justify="center"
      direction="column"
      gap="2"
      className="px-4 py-12 text-center"
    >
      <ChatCircleText size={28} weight="duotone" className="text-(--gray-9)" />
      <Text as="div" weight="medium" className="text-(--gray-12) text-[13px]">
        Ask about {project.name}
      </Text>
      <Text as="div" className="max-w-[420px] text-(--gray-10) text-[12px]">
        I have its dashboards, automations, and files in context. Type below —
        I'll respond as soon as I'm warmed up.
      </Text>
    </Flex>
  );
}
