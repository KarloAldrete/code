import { RobotIcon } from "@phosphor-icons/react";
import { useSetHeaderContent } from "@posthog/ui/hooks/useSetHeaderContent";
import { Flex, Text } from "@radix-ui/themes";
import { useMemo } from "react";

/**
 * Landing for the agent-platform console: the list of deployed agent
 * applications plus the fleet overview. M1 renders the chrome only — the
 * list, fleet stat strip, and live-now panel are wired to the
 * agent_platform REST API in a later milestone.
 */
export function AgentApplicationsListView() {
  const headerContent = useMemo(
    () => (
      <Flex align="center" gap="2" className="w-full min-w-0">
        <RobotIcon size={12} className="shrink-0 text-gray-10" />
        <Text
          className="truncate whitespace-nowrap font-medium text-[13px]"
          title="Applications"
        >
          Applications
        </Text>
      </Flex>
    ),
    [],
  );

  useSetHeaderContent(headerContent);

  return (
    <Flex direction="column" className="h-full min-h-0">
      <Flex
        direction="column"
        gap="0.5"
        className="cursor-default select-none border-(--gray-5) border-b px-6 pt-5 pb-5"
      >
        <Text className="font-bold text-[22px] text-gray-12 leading-tight tracking-tight">
          Applications
        </Text>
        <Text className="max-w-3xl text-[12.5px] text-gray-11 leading-snug">
          Deployed agents on the agent platform – their configuration, sessions,
          memory, and approvals.
        </Text>
      </Flex>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <Text className="text-[12.5px] text-gray-11">No agents yet.</Text>
        </div>
      </div>
    </Flex>
  );
}
