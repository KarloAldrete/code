import { useSetHeaderContent } from "@hooks/useSetHeaderContent";
import { Hammer } from "@phosphor-icons/react";
import { Flex, Text } from "@radix-ui/themes";
import { useMemo, useState } from "react";
import { BuildCanvas } from "./BuildCanvas";
import { BuildChatPanel } from "./BuildChatPanel";

export interface BuildMessage {
  id: string;
  role: "assistant" | "user";
  text: string;
}

const INITIAL_MESSAGE: BuildMessage = {
  id: "intro",
  role: "assistant",
  text: "Pick a build skill below, or describe what you'd like to monitor — I'll start scaffolding it on the canvas.",
};

export function BuildView() {
  const [messages, setMessages] = useState<BuildMessage[]>([INITIAL_MESSAGE]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const headerContent = useMemo(
    () => (
      <Flex align="center" gap="2" className="w-full min-w-0">
        <Hammer size={12} className="shrink-0 text-gray-10" />
        <Text
          className="truncate whitespace-nowrap font-medium text-[13px]"
          title="Build"
        >
          Build
        </Text>
      </Flex>
    ),
    [],
  );
  useSetHeaderContent(headerContent);

  const hasUserMessage = messages.some((m) => m.role === "user");

  const handleSubmit = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: "user", text: trimmed },
      {
        id: `a-${Date.now() + 1}`,
        role: "assistant",
        text: "Great — I'll start scaffolding that on the canvas. (Build coming soon)",
      },
    ]);
  };

  const handleSkillSelect = (prompt: string) => {
    handleSubmit(prompt);
  };

  return (
    <Flex
      direction="row"
      height="100%"
      className="overflow-hidden bg-(--gray-2)"
    >
      <Flex
        direction="column"
        flexGrow="1"
        className="min-w-0 overflow-hidden p-4"
      >
        <BuildCanvas
          isFullscreen={isFullscreen}
          onToggleFullscreen={() => setIsFullscreen((v) => !v)}
        />
      </Flex>

      {!isFullscreen && (
        <BuildChatPanel
          messages={messages}
          hasUserMessage={hasUserMessage}
          onSubmit={handleSubmit}
          onSkillSelect={handleSkillSelect}
        />
      )}
    </Flex>
  );
}
