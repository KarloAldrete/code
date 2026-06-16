import { ArrowLeftIcon } from "@phosphor-icons/react";
import { ConversationView } from "@posthog/ui/features/sessions/components/ConversationView";
import { useSetHeaderContent } from "@posthog/ui/hooks/useSetHeaderContent";
import { Badge } from "@posthog/ui/primitives/Badge";
import { Flex, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useMemo } from "react";
import { conversationToAcpMessages } from "../chat/conversationToAcp";
import { useAgentApplicationSession } from "../hooks/useAgentApplicationSession";
import { sessionStateColor } from "../utils/format";

/**
 * Read-only playback of a deployed agent's stored session transcript. The
 * stored conversation is mapped to ACP messages and handed to code's native
 * `ConversationView`, so deployed-agent chat renders identically to local
 * sessions. Live streaming + sending land in a later milestone.
 */
export function AgentSessionTranscriptView({
  idOrSlug,
  sessionId,
}: {
  idOrSlug: string;
  sessionId: string;
}) {
  const {
    data: session,
    isLoading,
    isError,
  } = useAgentApplicationSession(idOrSlug, sessionId);

  const events = useMemo(
    () => (session ? conversationToAcpMessages(session.conversation) : []),
    [session],
  );

  const headerContent = useMemo(
    () => (
      <Text className="truncate whitespace-nowrap font-medium text-[13px]">
        Session
      </Text>
    ),
    [],
  );
  useSetHeaderContent(headerContent);

  return (
    <Flex direction="column" className="h-full min-h-0">
      <Flex
        direction="column"
        gap="2"
        className="cursor-default select-none border-(--gray-5) border-b px-6 pt-5 pb-4"
      >
        <Link
          to="/code/agents/applications/$idOrSlug"
          params={{ idOrSlug }}
          className="flex w-fit items-center gap-1.5 text-[12px] text-gray-11 no-underline hover:text-gray-12"
        >
          <ArrowLeftIcon size={13} />
          Back to agent
        </Link>
        <Flex align="center" gap="2" wrap="wrap">
          <Text className="font-bold text-[18px] text-gray-12 leading-tight tracking-tight">
            Session transcript
          </Text>
          {session ? (
            <Badge color={sessionStateColor(session.state)}>
              {session.state}
            </Badge>
          ) : null}
          {session?.conversation_trimmed ? (
            <Badge color="gray">
              showing last {session.conversation.length} of{" "}
              {session.conversation_total_turns ?? session.conversation.length}
            </Badge>
          ) : null}
        </Flex>
      </Flex>

      <div className="min-h-0 flex-1">
        {isLoading ? (
          <Centered>
            <div className="h-24 w-full max-w-2xl animate-pulse rounded-(--radius-2) border border-border bg-(--gray-2)" />
          </Centered>
        ) : isError || !session ? (
          <Centered>
            <EmptyState
              title="Couldn't load this session"
              description="It may have been purged, or the agent platform API returned an error."
            />
          </Centered>
        ) : session.conversation.length === 0 ? (
          <Centered>
            <EmptyState
              title="No messages yet"
              description="This session hasn't produced any conversation turns."
            />
          </Centered>
        ) : (
          <ConversationView events={events} isPromptPending={null} />
        )}
      </div>
    </Flex>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center px-6 py-10">
      {children}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: ReactNode;
}) {
  return (
    <Flex
      direction="column"
      align="center"
      gap="1"
      className="rounded-(--radius-2) border border-(--gray-5) border-dashed px-6 py-10 text-center"
    >
      <Text className="font-medium text-[13px] text-gray-12">{title}</Text>
      <Text className="max-w-md text-[12px] text-gray-11 leading-snug">
        {description}
      </Text>
    </Flex>
  );
}
