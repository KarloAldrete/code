import { useAuthenticatedQuery } from "@hooks/useAuthenticatedQuery";
import {
  ArrowDown,
  ArrowRight,
  ArrowsClockwise,
  ArrowUp,
  PencilSimpleLine,
  Sparkle,
  TestTube,
} from "@phosphor-icons/react";
import { Box, Button, Flex, Heading, Text } from "@radix-ui/themes";
import type { Schemas } from "@renderer/api/generated";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { HOME_APPS, HOME_CANVASES } from "../dashboardData";
import {
  METRICS_META,
  type MetricMeta,
  TOP_GROUPS_HOGQL,
  useMetric,
  useTopGroups,
} from "../hooks/useHomeQueries";
import { useHomeStore } from "../store";
import { ROLES } from "../wizardConfig";
import { MetricDeepDiveModal } from "./MetricDeepDiveModal";
import { Sparkline } from "./Sparkline";

export function HomeDashboard() {
  const answers = useHomeStore((s) => s.answers);
  const reset = useHomeStore((s) => s.reset);
  const queryClient = useQueryClient();
  const [deepDiveKey, setDeepDiveKey] = useState<MetricMeta["key"] | null>(
    null,
  );
  const roleLabel = ROLES.find((r) => r.value === answers.role)?.label ?? null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["home"] });
  };

  return (
    <Flex direction="column" height="100%" className="overflow-hidden">
      <Flex
        align="center"
        justify="between"
        px="6"
        py="5"
        gap="4"
        className="shrink-0 border-gray-6 border-b"
      >
        <Box className="min-w-0">
          <Flex align="center" gap="2">
            <Sparkle size={14} weight="fill" className="text-(--accent-11)" />
            <Text
              size="1"
              weight="medium"
              className="text-(--accent-11) uppercase tracking-wide"
            >
              Built for you
            </Text>
          </Flex>
          <Heading size="6" className="text-(--gray-12)">
            Welcome back
          </Heading>
          <Text size="2" className="text-(--gray-11)">
            {roleLabel
              ? `Tailored for ${roleLabel.toLowerCase()} — monitoring experiments and top customers.`
              : "Your personalized home page."}
          </Text>
        </Box>
        <Flex gap="2" align="center" className="shrink-0">
          <Button variant="soft" color="gray" size="2" onClick={reset}>
            <ArrowsClockwise size={14} /> Rebuild home
          </Button>
          <Button variant="soft" size="2" onClick={() => undefined}>
            <PencilSimpleLine size={14} /> Edit with AI
          </Button>
          <Button size="2" onClick={refresh}>
            <ArrowsClockwise size={14} /> Refresh data
          </Button>
        </Flex>
      </Flex>

      <Flex flexGrow="1" className="min-h-0 overflow-hidden">
        <Box flexGrow="1" overflow="auto" className="min-w-0 px-6 py-6">
          <Flex direction="column" gap="4">
            <TopCustomersCard />
            <RecentExperimentsCard />
          </Flex>
        </Box>

        <RightPanel onOpenMetric={(k) => setDeepDiveKey(k)} />
      </Flex>

      <MetricDeepDiveModal
        metricKey={deepDiveKey}
        onClose={() => setDeepDiveKey(null)}
      />
    </Flex>
  );
}

function RightPanel({
  onOpenMetric,
}: {
  onOpenMetric: (k: MetricMeta["key"]) => void;
}) {
  return (
    <Box className="w-90 shrink-0 overflow-y-auto border-(--gray-5) border-l bg-(--gray-2)">
      <Flex direction="column" gap="4" p="4">
        <RightSection title="Metrics">
          <Flex direction="column" gap="2">
            {Object.values(METRICS_META).map((m) => (
              <LiveMetricCard key={m.key} meta={m} onOpen={onOpenMetric} />
            ))}
          </Flex>
        </RightSection>

        <YourCanvasesSection />

        <RightSection title="Your apps">
          <Flex
            direction="column"
            className="gap-px overflow-hidden rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1)"
          >
            {HOME_APPS.map((app) => {
              const Icon = app.icon;
              return (
                <button
                  type="button"
                  key={app.id}
                  onClick={() => undefined}
                  className="group flex items-center gap-3 border-(--gray-5) border-b px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-(--gray-2)"
                >
                  <Flex
                    align="center"
                    justify="center"
                    className={`h-7 w-7 shrink-0 rounded-(--radius-2) ${app.color}`}
                  >
                    <Icon size={14} />
                  </Flex>
                  <Flex direction="column" className="min-w-0 flex-1">
                    <Text
                      size="2"
                      weight="medium"
                      className="truncate text-(--gray-12)"
                    >
                      {app.name}
                    </Text>
                    <Text size="1" className="truncate text-(--gray-11)">
                      {app.description}
                    </Text>
                  </Flex>
                </button>
              );
            })}
          </Flex>
        </RightSection>
      </Flex>
    </Box>
  );
}

function RightSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Box>
      <Text
        size="1"
        weight="medium"
        className="mb-2 block text-(--gray-11) uppercase tracking-wide"
      >
        {title}
      </Text>
      {children}
    </Box>
  );
}

function LiveMetricCard({
  meta,
  onOpen,
}: {
  meta: MetricMeta;
  onOpen: (k: MetricMeta["key"]) => void;
}) {
  const { data, isLoading, error } = useMetric(meta.key);
  const series = useMemo(
    () => (data?.results ?? []).map((r) => Number(r[1])),
    [data],
  );
  const last = series.length > 0 ? series[series.length - 1] : null;
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const delta =
    last != null && prev != null && prev !== 0
      ? ((last - prev) / Math.abs(prev)) * 100
      : null;

  const status = error ? "error" : isLoading ? "loading" : "ok";

  return (
    <button
      type="button"
      onClick={() => onOpen(meta.key)}
      className="group flex items-center gap-3 rounded-(--radius-2) border border-(--gray-5) bg-(--gray-1) px-3 py-2 text-left transition-colors hover:border-(--accent-7) hover:bg-(--gray-1)"
    >
      <Flex direction="column" gap="0" className="min-w-0 flex-1">
        <Text size="1" className="text-(--gray-11) uppercase tracking-wide">
          {meta.label}
        </Text>
        <Text size="3" weight="medium" className="font-mono text-(--gray-12)">
          {status === "loading"
            ? "…"
            : status === "error"
              ? "—"
              : last != null
                ? fmtInt(last)
                : "—"}
        </Text>
      </Flex>
      <Sparkline
        values={series}
        width={72}
        height={24}
        stroke={meta.color.stroke}
        fill={meta.color.fill}
      />
      <Flex
        align="center"
        gap="1"
        className={`w-16 shrink-0 justify-end ${deltaColor(delta)}`}
      >
        {delta == null ? (
          <Text size="1" className="text-(--gray-10)">
            —
          </Text>
        ) : (
          <>
            {delta === 0 ? (
              <ArrowRight size={10} />
            ) : delta > 0 ? (
              <ArrowUp size={10} />
            ) : (
              <ArrowDown size={10} />
            )}
            <Text size="1" weight="medium">
              {Math.abs(delta).toFixed(1)}%
            </Text>
          </>
        )}
      </Flex>
    </button>
  );
}

function deltaColor(delta: number | null) {
  if (delta == null || delta === 0) return "text-(--gray-11)";
  return delta > 0 ? "text-(--green-11)" : "text-(--red-11)";
}

function YourCanvasesSection() {
  return (
    <RightSection title="Your canvases">
      <Flex
        direction="column"
        className="gap-px overflow-hidden rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1)"
      >
        {HOME_CANVASES.map((c) => {
          const Icon = c.icon;
          return (
            <button
              type="button"
              key={c.id}
              onClick={() => undefined}
              className="group flex items-center gap-3 border-(--gray-5) border-b px-3 py-2 text-left transition-colors last:border-b-0 hover:bg-(--gray-2)"
            >
              <Flex
                align="center"
                justify="center"
                className={`h-7 w-7 shrink-0 rounded-(--radius-2) ${c.color}`}
              >
                <Icon size={14} />
              </Flex>
              <Flex direction="column" className="min-w-0 flex-1">
                <Text
                  size="2"
                  weight="medium"
                  className="truncate text-(--gray-12)"
                >
                  {c.name}
                </Text>
                <Text size="1" className="truncate text-(--gray-11)">
                  {c.description}
                </Text>
              </Flex>
            </button>
          );
        })}
      </Flex>
    </RightSection>
  );
}

function Status({ message }: { message: string }) {
  return (
    <Flex align="center" justify="center" className="h-16 px-3">
      <Text size="1" className="text-(--gray-11)">
        {message}
      </Text>
    </Flex>
  );
}

function TopCustomersCard() {
  const { data, isLoading, error } = useTopGroups();
  const rows = useMemo(() => {
    const all = data?.results ?? [];
    return all.map((r) => ({ key: String(r[0]), count: Number(r[1]) }));
  }, [data]);
  const maxCount = rows.length > 0 ? rows[0].count : 0;

  return (
    <Box className="overflow-hidden rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1)">
      <Flex
        align="center"
        justify="between"
        px="4"
        py="3"
        className="border-gray-5 border-b"
      >
        <Box>
          <Heading size="3" className="text-(--gray-12)">
            Top 10 customers by event volume
          </Heading>
          <Text size="1" className="text-(--gray-11)">
            Organizations sending the most events in the last 30 days.
          </Text>
        </Box>
        <span
          className="rounded-(--radius-1) bg-(--gray-3) px-2 py-1 font-mono text-(--gray-11) text-[11px]"
          title={TOP_GROUPS_HOGQL}
        >
          HogQL
        </span>
      </Flex>
      {isLoading ? (
        <Status message="Querying PostHog…" />
      ) : error ? (
        <Status message={`Query failed: ${error.message}`} />
      ) : rows.length === 0 ? (
        <Status message="No organizations have sent events in the last 30 days." />
      ) : (
        <Flex direction="column" className="divide-y divide-(--gray-5)">
          {rows.map((row, i) => (
            <Flex
              key={row.key}
              align="center"
              gap="3"
              px="4"
              py="2"
              className="hover:bg-(--gray-2)"
            >
              <Text
                size="1"
                weight="medium"
                className="w-6 shrink-0 font-mono text-(--gray-10)"
              >
                {String(i + 1).padStart(2, "0")}
              </Text>
              <Text
                size="2"
                weight="medium"
                className="flex-1 truncate font-mono text-(--gray-12)"
                title={row.key}
              >
                {row.key}
              </Text>
              <Box className="h-1.5 w-32 shrink-0 overflow-hidden rounded-full bg-(--gray-3)">
                <Box
                  className="h-full bg-(--accent-9)"
                  style={{
                    width: `${(row.count / Math.max(maxCount, 1)) * 100}%`,
                  }}
                />
              </Box>
              <Text
                size="2"
                weight="medium"
                className="w-20 shrink-0 text-right font-mono text-(--gray-12)"
              >
                {fmtInt(row.count)}
              </Text>
            </Flex>
          ))}
        </Flex>
      )}
    </Box>
  );
}

function RecentExperimentsCard() {
  const { data, isLoading, error } =
    useAuthenticatedQuery<Schemas.PaginatedExperimentList>(
      ["home", "experiments"],
      (c) => c.listExperiments({ limit: 50 }),
      { staleTime: 60_000 },
    );

  const experiments = useMemo(() => {
    const all = data?.results ?? [];
    return [...all]
      .sort(
        (a, b) =>
          tsOrZero(b.start_date ?? b.created_at) -
          tsOrZero(a.start_date ?? a.created_at),
      )
      .slice(0, 6);
  }, [data]);

  return (
    <Box className="overflow-hidden rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1)">
      <Flex
        align="center"
        justify="between"
        px="4"
        py="3"
        className="border-gray-5 border-b"
      >
        <Box>
          <Heading size="3" className="text-(--gray-12)">
            Most recently launched experiments
          </Heading>
          <Text size="1" className="text-(--gray-11)">
            Sorted by start date — fetched live.
          </Text>
        </Box>
      </Flex>
      {isLoading ? (
        <Status message="Loading experiments…" />
      ) : error ? (
        <Status message={`Couldn't load experiments: ${error.message}`} />
      ) : experiments.length === 0 ? (
        <Status message="No experiments yet." />
      ) : (
        <Flex direction="column" className="divide-y divide-(--gray-5)">
          {experiments.map((e) => (
            <ExperimentRow key={e.id} experiment={e} />
          ))}
        </Flex>
      )}
    </Box>
  );
}

function ExperimentRow({ experiment }: { experiment: Schemas.Experiment }) {
  const status = (experiment.status ?? "draft").toString().toLowerCase();
  const statusStyle =
    status === "running"
      ? "bg-(--green-3) text-(--green-11)"
      : status === "complete" || status === "concluded"
        ? "bg-(--amber-3) text-(--amber-11)"
        : "bg-(--gray-3) text-(--gray-11)";

  const startedAt = experiment.start_date ?? experiment.created_at;
  const endedAt = experiment.end_date;
  const isConcluded = endedAt != null;

  return (
    <Flex gap="3" px="4" py="3" align="start">
      <Flex
        align="center"
        justify="center"
        className="mt-0.5 h-7 w-7 shrink-0 rounded-(--radius-2) bg-(--purple-3) text-(--purple-11)"
      >
        <TestTube size={14} />
      </Flex>
      <Flex direction="column" gap="1" className="min-w-0 flex-1">
        <Flex align="center" gap="2" wrap="wrap">
          <Text size="2" weight="medium" className="truncate text-(--gray-12)">
            {experiment.name}
          </Text>
          <Text
            size="1"
            className={`rounded-(--radius-1) px-1.5 py-0.5 uppercase tracking-wide ${statusStyle}`}
          >
            {status}
          </Text>
        </Flex>
        {experiment.description && (
          <Text size="1" className="truncate text-(--gray-11)">
            {experiment.description}
          </Text>
        )}
        <Text size="1" className="text-(--gray-10)">
          {isConcluded
            ? `Ended ${formatRelative(endedAt)} · Started ${formatRelative(startedAt)}`
            : `Started ${formatRelative(startedAt)}`}
        </Text>
      </Flex>
    </Flex>
  );
}

function tsOrZero(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  const diffMs = Date.now() - t;
  const day = 24 * 60 * 60 * 1000;
  const d = Math.max(0, Math.floor(diffMs / day));
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d}d ago`;
  const months = Math.floor(d / 30);
  return `${months}mo ago`;
}

function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}
