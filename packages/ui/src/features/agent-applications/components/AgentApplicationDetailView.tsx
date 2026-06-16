import { Flex, Text } from "@radix-ui/themes";
import { useAgentApplicationSessions } from "../hooks/useAgentApplicationSessions";
import { useAgentApplicationStats } from "../hooks/useAgentApplicationStats";
import { formatSpendUsd } from "../utils/format";
import { AgentDetailEmptyState, AgentDetailLayout } from "./AgentDetailLayout";
import { AgentSessionRow } from "./AgentSessionRow";

/**
 * Per-agent Overview pane: stat strip + recent sessions. Rendered inside the
 * shared {@link AgentDetailLayout} tab shell.
 */
export function AgentApplicationDetailView({ idOrSlug }: { idOrSlug: string }) {
  const { data: stats } = useAgentApplicationStats(idOrSlug);
  const { data: sessions, isLoading: sessionsLoading } =
    useAgentApplicationSessions(idOrSlug, { limit: 25 });

  return (
    <AgentDetailLayout idOrSlug={idOrSlug} activeTab="overview">
      <Flex direction="column" gap="6">
        <StatStrip
          liveCount={stats?.liveCount ?? 0}
          sessionsInWindowCount={stats?.sessionsInWindowCount ?? 0}
          spendInWindowUsd={stats?.spendInWindowUsd ?? 0}
          failedInWindowCount={stats?.failedInWindowCount ?? 0}
        />

        <section>
          <Text className="mb-3 block font-semibold text-[13px] text-gray-12">
            Recent sessions
          </Text>
          {sessionsLoading ? (
            <Flex direction="column" gap="2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-[52px] animate-pulse rounded-(--radius-2) border border-border bg-(--gray-2)"
                />
              ))}
            </Flex>
          ) : !sessions || sessions.results.length === 0 ? (
            <AgentDetailEmptyState
              title="No sessions yet"
              description="Sessions this agent runs will appear here."
            />
          ) : (
            <Flex direction="column" gap="2">
              {sessions.results.map((session) => (
                <AgentSessionRow
                  key={session.id}
                  session={session}
                  idOrSlug={idOrSlug}
                />
              ))}
            </Flex>
          )}
        </section>
      </Flex>
    </AgentDetailLayout>
  );
}

function StatStrip({
  liveCount,
  sessionsInWindowCount,
  spendInWindowUsd,
  failedInWindowCount,
}: {
  liveCount: number;
  sessionsInWindowCount: number;
  spendInWindowUsd: number;
  failedInWindowCount: number;
}) {
  return (
    <Flex
      gap="0"
      className="overflow-hidden rounded-(--radius-2) border border-border bg-(--color-panel-solid)"
    >
      <Stat label="Live" value={String(liveCount)} />
      <Stat label="Sessions (24h)" value={String(sessionsInWindowCount)} />
      <Stat label="Spend (24h)" value={formatSpendUsd(spendInWindowUsd)} />
      <Stat label="Failed (24h)" value={String(failedInWindowCount)} last />
    </Flex>
  );
}

function Stat({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
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
      <Text className="font-semibold text-[18px] text-gray-12 leading-none">
        {value}
      </Text>
    </Flex>
  );
}
