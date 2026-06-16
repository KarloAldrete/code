import { CaretRightIcon, RobotIcon } from "@phosphor-icons/react";
import type { AgentApplication } from "@posthog/shared/agent-platform-types";
import { AgentsTabLayout } from "@posthog/ui/features/agents/components/AgentsTabLayout";
import { Badge } from "@posthog/ui/primitives/Badge";
import { Flex, Text } from "@radix-ui/themes";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAgentApplications } from "../hooks/useAgentApplications";
import { useAgentFleetStats } from "../hooks/useAgentFleetStats";
import { formatSpendUsd } from "../utils/format";

/**
 * The Applications tab: a fleet stat strip plus the list of deployed agent
 * applications. Each row links to the per-agent detail view.
 */
export function AgentApplicationsListView() {
  const {
    data: applications,
    isLoading,
    isError,
    error,
  } = useAgentApplications();
  const { data: fleetStats } = useAgentFleetStats();

  return (
    <AgentsTabLayout activeTab="applications">
      <Flex direction="column" gap="5">
        <FleetStatStrip
          liveCount={fleetStats?.liveCount ?? 0}
          sessionsInWindowCount={fleetStats?.sessionsInWindowCount ?? 0}
          spendInWindowUsd={fleetStats?.spendInWindowUsd ?? 0}
          failedInWindowCount={fleetStats?.failedInWindowCount ?? 0}
          pendingApprovalsCount={fleetStats?.pendingApprovalsCount ?? 0}
        />

        {isLoading ? (
          <ApplicationsSkeleton />
        ) : isError ? (
          <EmptyState
            title="Couldn't load applications"
            description={
              error instanceof Error
                ? error.message
                : "The agent platform API returned an error."
            }
          />
        ) : !applications || applications.length === 0 ? (
          <EmptyState
            title="No agents yet"
            description="Deployed agents on the agent platform will show up here."
          />
        ) : (
          <Flex direction="column" gap="2">
            {applications.map((app) => (
              <ApplicationRow key={app.id} application={app} />
            ))}
          </Flex>
        )}
      </Flex>
    </AgentsTabLayout>
  );
}

interface FleetStatStripProps {
  liveCount: number;
  sessionsInWindowCount: number;
  spendInWindowUsd: number;
  failedInWindowCount: number;
  pendingApprovalsCount: number;
}

function FleetStatStrip({
  liveCount,
  sessionsInWindowCount,
  spendInWindowUsd,
  failedInWindowCount,
  pendingApprovalsCount,
}: FleetStatStripProps) {
  return (
    <Flex
      gap="0"
      className="overflow-hidden rounded-(--radius-2) border border-border bg-(--color-panel-solid)"
    >
      <Stat label="Live" value={String(liveCount)} />
      <Stat label="Sessions (24h)" value={String(sessionsInWindowCount)} />
      <Stat label="Spend (24h)" value={formatSpendUsd(spendInWindowUsd)} />
      <Stat
        label="Failed (24h)"
        value={String(failedInWindowCount)}
        emphasize={failedInWindowCount > 0 ? "red" : undefined}
      />
      <Stat
        label="Approvals"
        value={String(pendingApprovalsCount)}
        emphasize={pendingApprovalsCount > 0 ? "amber" : undefined}
        last
      />
    </Flex>
  );
}

function Stat({
  label,
  value,
  emphasize,
  last,
}: {
  label: string;
  value: string;
  emphasize?: "red" | "amber";
  last?: boolean;
}) {
  const valueColor =
    emphasize === "red"
      ? "text-(--red-11)"
      : emphasize === "amber"
        ? "text-(--amber-11)"
        : "text-gray-12";
  return (
    <Flex
      direction="column"
      gap="1"
      className={`min-w-0 flex-1 px-4 py-3 ${
        last ? "" : "border-(--gray-5) border-r"
      }`}
    >
      <Text className="truncate text-[11px] text-gray-10 uppercase tracking-wide">
        {label}
      </Text>
      <Text className={`font-semibold text-[18px] leading-none ${valueColor}`}>
        {value}
      </Text>
    </Flex>
  );
}

function ApplicationRow({ application }: { application: AgentApplication }) {
  const isLive = application.live_revision != null;
  return (
    <Link
      to="/code/agents/applications/$idOrSlug"
      params={{ idOrSlug: application.slug ?? application.id }}
      className="flex items-center justify-between gap-3 rounded-(--radius-2) border border-border bg-(--color-panel-solid) px-4 py-3.5 no-underline transition-colors duration-150 hover:border-(--gray-6) hover:bg-(--gray-2)"
    >
      <Flex align="center" gap="3" className="min-w-0">
        <RobotIcon size={20} className="shrink-0 text-gray-11" />
        <Flex direction="column" gap="0.5" className="min-w-0">
          <Flex align="center" gap="2" className="min-w-0">
            <Text className="truncate font-medium text-[13px] text-gray-12">
              {application.name}
            </Text>
            <Badge color={isLive ? "green" : "gray"}>
              {isLive ? "Live" : "Draft"}
            </Badge>
          </Flex>
          <Text className="truncate text-[12px] text-gray-11 leading-snug">
            {application.description?.trim()
              ? application.description
              : (application.slug ?? application.id)}
          </Text>
        </Flex>
      </Flex>
      <CaretRightIcon size={14} className="shrink-0 text-gray-10" />
    </Link>
  );
}

function ApplicationsSkeleton() {
  return (
    <Flex direction="column" gap="2">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-[58px] animate-pulse rounded-(--radius-2) border border-border bg-(--gray-2)"
        />
      ))}
    </Flex>
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
