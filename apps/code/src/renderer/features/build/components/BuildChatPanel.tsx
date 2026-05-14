import { ConnectorsMenu } from "@features/message-editor/components/ConnectorsMenu";
import { PromptInput } from "@features/message-editor/components/PromptInput";
import type { EditorHandle } from "@features/message-editor/types";
import {
  ChartBar,
  ChartPieSlice,
  Heart,
  type Icon,
  Megaphone,
  RocketLaunch,
} from "@phosphor-icons/react";
import { Box, Flex, Text } from "@radix-ui/themes";
import { useEffect, useRef } from "react";
import type { BuildMessage } from "./BuildView";

interface BuildSkill {
  id: string;
  title: string;
  description: string;
  icon: Icon;
  prompt: string;
}

const BUILD_SKILLS: BuildSkill[] = [
  {
    id: "customer-health",
    title: "Customer health dashboard",
    description:
      "Track activation, retention, and engagement signals for each account.",
    icon: Heart,
    prompt: "Build a customer health dashboard for me",
  },
  {
    id: "feature-launch",
    title: "New feature launch tracking",
    description:
      "Adoption, exposure, and downstream impact for a feature you just shipped.",
    icon: RocketLaunch,
    prompt: "Build a new feature launch tracking dashboard",
  },
  {
    id: "marketing-analytics",
    title: "Marketing analytics dashboard",
    description: "Channel attribution, campaign performance, and CAC trends.",
    icon: Megaphone,
    prompt: "Build a marketing analytics dashboard",
  },
  {
    id: "revenue-overview",
    title: "Revenue overview",
    description: "MRR, churn, expansion, and the cohorts that move them.",
    icon: ChartBar,
    prompt: "Build a revenue overview dashboard",
  },
  {
    id: "onboarding-funnel",
    title: "Onboarding funnel monitor",
    description:
      "Step-by-step funnel from signup to activated, with drop-off alerts.",
    icon: ChartPieSlice,
    prompt: "Build an onboarding funnel monitor",
  },
];

interface BuildChatPanelProps {
  messages: BuildMessage[];
  hasUserMessage: boolean;
  onSubmit: (text: string) => void;
  onSkillSelect: (prompt: string) => void;
}

export function BuildChatPanel({
  messages,
  hasUserMessage,
  onSubmit,
  onSkillSelect,
}: BuildChatPanelProps) {
  const editorRef = useRef<EditorHandle>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  return (
    <Flex
      direction="column"
      className="w-95 shrink-0 border-(--gray-5) border-l bg-(--gray-1)"
    >
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <Flex direction="column" gap="3" p="4">
          {messages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}

          {!hasUserMessage && (
            <Flex direction="column" gap="2" mt="2">
              <Text size="1" weight="medium" className="text-(--gray-11)">
                Build skills
              </Text>
              <Flex direction="column" gap="2">
                {BUILD_SKILLS.map((skill) => (
                  <BuildSkillCard
                    key={skill.id}
                    skill={skill}
                    onClick={() => onSkillSelect(skill.prompt)}
                  />
                ))}
              </Flex>
            </Flex>
          )}
        </Flex>
      </div>

      <Box className="shrink-0 border-(--gray-5) border-t p-3">
        <PromptInput
          ref={editorRef}
          sessionId="build-chat"
          placeholder="Describe what you want to build..."
          editorHeight="default"
          clearOnSubmit
          onSubmit={onSubmit}
          connectorsSlot={<ConnectorsMenu />}
        />
      </Box>
    </Flex>
  );
}

function ChatBubble({ message }: { message: BuildMessage }) {
  const isUser = message.role === "user";
  return (
    <Flex justify={isUser ? "end" : "start"} className="w-full">
      <Box
        className={
          isUser
            ? "max-w-[80%] rounded-(--radius-3) bg-(--accent-9) px-3 py-2 text-white"
            : "max-w-[90%] rounded-(--radius-3) bg-(--gray-3) px-3 py-2 text-(--gray-12)"
        }
      >
        <Text size="2" className="whitespace-pre-wrap">
          {message.text}
        </Text>
      </Box>
    </Flex>
  );
}

function BuildSkillCard({
  skill,
  onClick,
}: {
  skill: BuildSkill;
  onClick: () => void;
}) {
  const Icon = skill.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col gap-1 rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1) p-3 text-left transition-all hover:border-(--accent-7) hover:bg-(--gray-2)"
    >
      <Flex align="center" gap="2">
        <Flex
          align="center"
          justify="center"
          className="h-7 w-7 shrink-0 rounded-(--radius-2) bg-(--accent-3) text-(--accent-11)"
        >
          <Icon size={14} />
        </Flex>
        <Text size="2" weight="medium" className="text-(--gray-12)">
          {skill.title}
        </Text>
      </Flex>
      <Text size="1" className="text-(--gray-11)">
        {skill.description}
      </Text>
    </button>
  );
}
