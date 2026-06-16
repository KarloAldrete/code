import { RobotIcon } from "@phosphor-icons/react";
import { useSetConciergePage } from "@posthog/ui/features/agent-applications/concierge/useSetConciergePage";
import { useSetHeaderContent } from "@posthog/ui/hooks/useSetHeaderContent";
import { Flex, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useMemo } from "react";

export type AgentsTab = "scouts" | "applications";

/**
 * Shared chrome for the two top-level Agents tabs. Each tab view renders its
 * own content inside this layout and declares which tab is active, so the
 * header + tab bar stay identical across Scouts and Applications while detail
 * pages (a scout, an agent, a session) keep their own focused chrome.
 */
export function AgentsTabLayout({
  activeTab,
  children,
}: {
  activeTab: AgentsTab;
  children: ReactNode;
}) {
  const headerContent = useMemo(
    () => (
      <Flex align="center" gap="2" className="w-full min-w-0">
        <RobotIcon size={12} className="shrink-0 text-gray-10" />
        <Text
          className="truncate whitespace-nowrap font-medium text-[13px]"
          title="Agents"
        >
          Agents
        </Text>
      </Flex>
    ),
    [],
  );
  useSetHeaderContent(headerContent);
  useSetConciergePage(
    activeTab === "applications" ? { kind: "agent-list" } : { kind: "scouts" },
  );

  return (
    <Flex direction="column" className="h-full min-h-0">
      <div className="cursor-default select-none border-(--gray-5) border-b px-6 pt-5">
        <Flex direction="column" gap="0.5" className="pb-3.5">
          <Text className="font-bold text-[22px] text-gray-12 leading-tight tracking-tight">
            Agents
          </Text>
          <Text className="max-w-3xl text-[12.5px] text-gray-11 leading-snug">
            Design, schedule, and deploy the agents that work on your product.
          </Text>
        </Flex>
        <Flex gap="5" align="center">
          <TabLink
            to="/code/agents/scouts"
            label="Scouts"
            active={activeTab === "scouts"}
          />
          <TabLink
            to="/code/agents/applications"
            label="Applications"
            active={activeTab === "applications"}
          />
        </Flex>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-4xl px-6 py-6">{children}</div>
      </div>
    </Flex>
  );
}

function TabLink({
  to,
  label,
  active,
}: {
  to: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      className={`-mb-px border-b-2 px-0.5 pb-2.5 text-[13px] no-underline transition-colors ${
        active
          ? "border-(--accent-9) font-medium text-gray-12"
          : "border-transparent text-gray-11 hover:text-gray-12"
      }`}
    >
      {label}
    </Link>
  );
}
