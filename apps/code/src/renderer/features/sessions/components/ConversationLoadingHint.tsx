import { Spinner } from "@phosphor-icons/react";
import { Flex, Text } from "@radix-ui/themes";
import type { TaskRunStatus } from "@shared/types";

interface ConversationLoadingHintProps {
  status: "connecting" | "connected" | "disconnected" | "error" | undefined;
  isCloud: boolean;
  cloudStatus: TaskRunStatus | null | undefined;
  eventCount: number;
  isPromptPending: boolean | null;
}

function hintCopy({
  status,
  isCloud,
  cloudStatus,
  eventCount,
  isPromptPending,
}: ConversationLoadingHintProps): string | null {
  // The footer's GeneratingIndicator already covers the active-turn case.
  if (isPromptPending) return null;
  if (eventCount === 0) return null;

  if (!isCloud) {
    return status === "connecting" ? "Reconnecting to your agent…" : null;
  }

  // Cloud: events have started arriving but the run is still in flight and no
  // turn is currently being generated — most likely we're catching up on
  // historical events from log polling.
  if (cloudStatus === "queued" || cloudStatus === "in_progress") {
    return "Loading more messages…";
  }
  return null;
}

export function ConversationLoadingHint(props: ConversationLoadingHintProps) {
  const copy = hintCopy(props);
  if (!copy) return null;

  return (
    <Flex
      align="center"
      justify="center"
      gap="2"
      className="pointer-events-none mx-auto w-fit rounded-full border border-(--gray-5) bg-(--gray-2) px-3 py-1"
    >
      <Spinner size={12} className="animate-spin text-gray-9" />
      <Text color="gray" className="text-[12px]">
        {copy}
      </Text>
    </Flex>
  );
}
