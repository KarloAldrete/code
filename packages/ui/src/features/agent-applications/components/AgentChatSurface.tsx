import { PaperPlaneTiltIcon, StopIcon } from "@phosphor-icons/react";
import type { AcpMessage } from "@posthog/shared";
import { ConversationView } from "@posthog/ui/features/sessions/components/ConversationView";
import { Button } from "@posthog/ui/primitives/Button";
import { Flex, Text, TextArea } from "@radix-ui/themes";
import { type KeyboardEvent, useState } from "react";

/**
 * The conversation + composer half of a deployed-agent chat, shared by the
 * per-agent preview pane and the concierge dock. Renders the live ACP messages
 * through the native `ConversationView` (collapse disabled so the agent's prose
 * shows inline) and a single-line composer with Enter-to-send / Cancel.
 */
export function AgentChatSurface({
  messages,
  isStreaming,
  error,
  emptyHint,
  onSend,
  onCancel,
}: {
  messages: AcpMessage[];
  isStreaming: boolean;
  error: string | null;
  emptyHint: string;
  onSend: (text: string) => void;
  onCancel: () => void;
}) {
  return (
    <Flex direction="column" className="min-h-0 flex-1">
      <div className="flex min-h-0 flex-1 flex-col">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <Text className="max-w-sm text-[13px] text-gray-10 leading-snug">
              {emptyHint}
            </Text>
          </div>
        ) : (
          <ConversationView
            events={messages}
            isPromptPending={isStreaming}
            collapseMode="none"
          />
        )}
      </div>
      {error ? (
        <Text className="shrink-0 px-4 pb-1 text-(--red-11) text-[12px]">
          {error}
        </Text>
      ) : null}
      <Composer isStreaming={isStreaming} onSend={onSend} onCancel={onCancel} />
    </Flex>
  );
}

function Composer({
  isStreaming,
  onSend,
  onCancel,
}: {
  isStreaming: boolean;
  onSend: (text: string) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState("");

  function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  }
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <Flex
      align="end"
      gap="2"
      className="shrink-0 border-(--gray-5) border-t px-4 py-3"
    >
      <TextArea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Message this agent…"
        rows={1}
        className="flex-1 text-[13px]"
      />
      {isStreaming ? (
        <Button variant="soft" color="gray" size="2" onClick={onCancel}>
          <StopIcon size={14} />
          Cancel
        </Button>
      ) : (
        <Button size="2" onClick={submit} disabled={!text.trim()}>
          <PaperPlaneTiltIcon size={14} />
          Send
        </Button>
      )}
    </Flex>
  );
}
