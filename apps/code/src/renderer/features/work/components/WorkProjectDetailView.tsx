import { useAuthenticatedQuery } from "@hooks/useAuthenticatedQuery";
import {
  ArrowLeft,
  ArrowSquareOut,
  ArrowsCounterClockwise,
  ArrowsOutCardinal,
  ChartLineUp,
  Check,
  DotsThree,
  FileText,
  GaugeIcon,
  GitBranch,
  GitCommit,
  GitMerge,
  GitPullRequest,
  Lightbulb,
  Lightning,
  PencilSimple,
  Plus,
  Tag,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { Box, Flex, Text } from "@radix-ui/themes";
import { useNavigationStore } from "@stores/navigationStore";
import { useProjectEditsStore } from "@stores/projectEditsStore";
import {
  DEFAULT_PROJECT_LAYOUT,
  PROJECT_GRID_BREAKPOINTS,
  PROJECT_GRID_COLS,
  PROJECT_GRID_ROW_HEIGHT,
  PROJECT_WIDGET_IDS,
  type ProjectGridBreakpoint,
  type ProjectWidgetId,
  useProjectLayoutStore,
} from "@stores/projectLayoutStore";
import { useWorkSkillsStore } from "@stores/workSkillsStore";
import { openUrlInBrowser } from "@utils/browser";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type Layout,
  Responsive,
  WidthProvider,
} from "react-grid-layout/legacy";
import { getProjectIcon } from "../data/projectIcons";
import {
  getProject,
  type Project,
  type ProjectActivityEntry,
  type ProjectGitHubRepo,
  type ProjectHeadlineStat,
} from "../data/projects";
import { ProjectChatPanel } from "./ProjectChatPanel";

const ResponsiveGridLayout = WidthProvider(Responsive);

interface TrendsResult {
  data: number[];
  labels: string[];
  days: string[];
  count?: number;
  aggregated_value?: number;
  label?: string;
}

interface TrendsResponse {
  results: TrendsResult[];
}

function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

function describeDelta(values: number[]): string | null {
  if (values.length < 4) return null;
  const half = Math.floor(values.length / 2);
  const recent = values.slice(values.length - half);
  const prior = values.slice(values.length - half * 2, values.length - half);
  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const recentSum = sum(recent);
  const priorSum = sum(prior);
  if (priorSum === 0) {
    return recentSum > 0 ? `+${formatCompactNumber(recentSum)} vs. 0` : null;
  }
  const ratio = recentSum / priorSum;
  if (ratio >= 2) {
    return `+${ratio.toFixed(1)}× vs. prior ${half} days`;
  }
  const pct = ((recentSum - priorSum) / priorSum) * 100;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct.toFixed(0)}% vs. prior ${half} days`;
}

function useLiveHeadline(headline: ProjectHeadlineStat | undefined) {
  const query = headline?.query;
  return useAuthenticatedQuery<TrendsResponse>(
    [
      "project-headline-trends",
      query?.posthogProjectId,
      JSON.stringify(query?.body ?? null),
    ],
    (client) =>
      client.runQuery<TrendsResponse>(
        // biome-ignore lint/style/noNonNullAssertion: gated by enabled flag below
        query!.posthogProjectId,
        // biome-ignore lint/style/noNonNullAssertion: gated by enabled flag below
        query!.body,
      ),
    {
      enabled: !!query,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  );
}

function SparklineBars({
  values,
  labels,
}: {
  values: number[];
  labels?: string[];
}) {
  const width = 220;
  const height = 40;
  const gap = 2;
  const n = values.length;
  if (n === 0) return null;
  const max = Math.max(...values, 1);
  const barWidth = Math.max(1, (width - gap * (n - 1)) / n);
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend sparkline"
    >
      <title>Trend sparkline</title>
      {values.map((v, i) => {
        const h = Math.max(1, (v / max) * (height - 2));
        const x = i * (barWidth + gap);
        const y = height - h;
        return (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: stable positional bars
            key={i}
            x={x}
            y={y}
            width={barWidth}
            height={h}
            fill="var(--green-11)"
            rx={1}
          >
            <title>{labels?.[i] ? `${labels[i]}: ${v}` : String(v)}</title>
          </rect>
        );
      })}
    </svg>
  );
}

function HeadlineCard({ headline }: { headline: ProjectHeadlineStat }) {
  const { data, isLoading, isError } = useLiveHeadline(headline);

  const series = data?.results?.[0];
  const liveValues = series?.data;
  const liveLabels = series?.labels;
  const liveTotal = series?.aggregated_value ?? series?.count;

  const usingLive = !!liveValues && liveValues.length > 0;
  const values = usingLive ? liveValues : headline.sparkline;
  const labels = usingLive ? liveLabels : undefined;
  const valueText = usingLive
    ? formatCompactNumber(liveTotal ?? liveValues.reduce((a, b) => a + b, 0))
    : headline.value;
  const deltaText = usingLive
    ? (describeDelta(liveValues) ?? headline.delta)
    : headline.delta;
  const headlineLabel = usingLive
    ? (headline.query?.displayLabel ?? headline.label)
    : headline.label;

  const statusLabel = isError
    ? "Last refresh failed"
    : isLoading && !usingLive
      ? "Loading…"
      : usingLive
        ? "Live"
        : "Cached";

  return (
    <Box className="rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1) p-4">
      <Flex align="center" justify="between" gap="2">
        <Flex align="center" gap="2">
          <Box
            className={`h-1.5 w-1.5 rounded-full ${
              isError
                ? "bg-(--red-9)"
                : usingLive
                  ? "animate-pulse bg-(--green-9)"
                  : "bg-(--gray-8)"
            }`}
          />
          <Text
            as="span"
            className="text-(--gray-10) text-[11px] uppercase tracking-wide"
          >
            {statusLabel} · {headlineLabel}
          </Text>
        </Flex>
        <button
          type="button"
          onClick={() => openUrlInBrowser(headline.posthogUrl)}
          className="flex items-center gap-1 text-(--gray-10) text-[11px] hover:text-(--gray-12)"
        >
          View in PostHog
          <ArrowSquareOut size={10} weight="bold" />
        </button>
      </Flex>
      <Flex align="baseline" gap="3" className="mt-1">
        <Text
          as="span"
          weight="medium"
          className="text-(--gray-12) text-[32px] leading-tight"
        >
          {valueText}
        </Text>
        <Text as="span" className="text-(--green-11) text-[12px]">
          {deltaText}
        </Text>
      </Flex>
      <Box className="mt-2">
        <SparklineBars values={values} labels={labels} />
      </Box>
    </Box>
  );
}

function SectionHeader({
  icon,
  title,
  count,
  action,
}: {
  icon: ReactNode;
  title: string;
  count?: number;
  action?: ReactNode;
}) {
  return (
    <Flex align="center" justify="between" gap="2" className="mb-2">
      <Flex align="center" gap="2" className="text-(--gray-11)">
        {icon}
        <Text
          as="span"
          weight="medium"
          className="text-(--gray-12) text-[13px]"
        >
          {title}
        </Text>
        {count !== undefined && (
          <Text as="span" className="text-(--gray-10) text-[12px]">
            {count}
          </Text>
        )}
      </Flex>
      {action}
    </Flex>
  );
}

function DashboardsCard({ project }: { project: Project }) {
  if (!project.dashboards?.length) return null;
  return (
    <Box>
      <SectionHeader
        icon={<GaugeIcon size={14} weight="duotone" />}
        title="Dashboards"
        count={project.dashboards.length}
        action={
          <button
            type="button"
            className="flex items-center gap-1 text-(--gray-10) text-[11px] hover:text-(--gray-12)"
          >
            <Plus size={11} weight="bold" />
            Add
          </button>
        }
      />
      <Box className="overflow-hidden rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1)">
        {project.dashboards.map((d, i) => (
          <button
            type="button"
            key={d.id}
            onClick={() => openUrlInBrowser(d.url)}
            className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-(--gray-2) ${
              i > 0 ? "border-(--gray-4) border-t" : ""
            }`}
          >
            <Box className="mt-0.5 text-(--gray-10)">
              <ChartLineUp size={14} weight="regular" />
            </Box>
            <Box className="min-w-0 flex-1">
              <Flex align="center" gap="1.5">
                <Text
                  as="span"
                  weight="medium"
                  className="truncate text-(--gray-12) text-[13px]"
                >
                  {d.name}
                </Text>
                <ArrowSquareOut
                  size={10}
                  weight="bold"
                  className="shrink-0 text-(--gray-9)"
                />
              </Flex>
              <Text
                as="div"
                className="line-clamp-1 text-(--gray-11) text-[11px]"
              >
                {d.description}
              </Text>
            </Box>
            <Text as="span" className="shrink-0 text-(--gray-10) text-[11px]">
              {d.owner}
            </Text>
          </button>
        ))}
      </Box>
    </Box>
  );
}

function AutomationsCard({ project }: { project: Project }) {
  if (!project.automations?.length) return null;
  return (
    <Box>
      <SectionHeader
        icon={<Lightning size={14} weight="duotone" />}
        title="Automations"
        count={project.automations.length}
        action={
          <button
            type="button"
            className="flex items-center gap-1 text-(--gray-10) text-[11px] hover:text-(--gray-12)"
          >
            <Plus size={11} weight="bold" />
            New
          </button>
        }
      />
      <Box className="overflow-hidden rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1)">
        {project.automations.map((a, i) => (
          <Box
            key={a.id}
            className={`px-3 py-2.5 ${
              i > 0 ? "border-(--gray-4) border-t" : ""
            }`}
          >
            <Flex align="center" justify="between" gap="2">
              <Flex align="center" gap="2" className="min-w-0">
                <Box
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    a.enabled ? "bg-(--green-9)" : "bg-(--gray-7)"
                  }`}
                />
                <Text
                  as="span"
                  weight="medium"
                  className="truncate text-(--gray-12) text-[13px]"
                >
                  {a.title}
                </Text>
              </Flex>
              <Text as="span" className="shrink-0 text-(--gray-10) text-[11px]">
                {a.schedule}
              </Text>
            </Flex>
            <Text
              as="div"
              className="mt-0.5 line-clamp-1 text-(--gray-11) text-[11px]"
            >
              {a.description}
            </Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function FilesCard({ project }: { project: Project }) {
  if (!project.files?.length) return null;
  return (
    <Box>
      <SectionHeader
        icon={<FileText size={14} weight="duotone" />}
        title="Files"
        count={project.files.length}
        action={
          <button
            type="button"
            className="flex items-center gap-1 text-(--gray-10) text-[11px] hover:text-(--gray-12)"
          >
            <Plus size={11} weight="bold" />
            Add
          </button>
        }
      />
      <Box className="overflow-hidden rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1)">
        {project.files.map((f, i) => (
          <Flex
            key={f.id}
            align="center"
            justify="between"
            gap="2"
            className={`px-3 py-2 ${i > 0 ? "border-(--gray-4) border-t" : ""}`}
          >
            <Flex align="center" gap="2" className="min-w-0">
              <FileText
                size={13}
                weight="regular"
                className="shrink-0 text-(--gray-10)"
              />
              <Text
                as="span"
                className="truncate font-mono text-(--gray-12) text-[12px]"
              >
                {f.name}
              </Text>
            </Flex>
            <Text as="span" className="shrink-0 text-(--gray-10) text-[11px]">
              {f.updatedLabel}
            </Text>
          </Flex>
        ))}
      </Box>
    </Box>
  );
}

const ACTIVITY_ICON: Record<ProjectActivityEntry["kind"], ReactNode> = {
  commit: <GitCommit size={13} weight="regular" />,
  pr_opened: <GitPullRequest size={13} weight="regular" />,
  pr_merged: <GitMerge size={13} weight="regular" />,
  issue_opened: <WarningCircle size={13} weight="regular" />,
  issue_closed: <WarningCircle size={13} weight="regular" />,
  release: <Tag size={13} weight="regular" />,
};

const ACTIVITY_ICON_TONE: Record<ProjectActivityEntry["kind"], string> = {
  commit: "text-(--gray-10)",
  pr_opened: "text-(--green-11)",
  pr_merged: "text-(--purple-11)",
  issue_opened: "text-(--amber-11)",
  issue_closed: "text-(--gray-10)",
  release: "text-(--blue-11)",
};

function GitHubSummaryChips({
  summary,
}: {
  summary: ProjectGitHubRepo["summary"];
}) {
  if (!summary) return null;
  const chips: { label: string; count: number; tone: string }[] = [];
  if (summary.prsMerged)
    chips.push({
      label: summary.prsMerged === 1 ? "PR merged" : "PRs merged",
      count: summary.prsMerged,
      tone: "text-(--purple-11)",
    });
  if (summary.prsOpened)
    chips.push({
      label: summary.prsOpened === 1 ? "PR opened" : "PRs opened",
      count: summary.prsOpened,
      tone: "text-(--green-11)",
    });
  if (summary.commits)
    chips.push({
      label: summary.commits === 1 ? "commit" : "commits",
      count: summary.commits,
      tone: "text-(--gray-11)",
    });
  if (summary.issuesOpened)
    chips.push({
      label: summary.issuesOpened === 1 ? "issue" : "issues",
      count: summary.issuesOpened,
      tone: "text-(--amber-11)",
    });
  if (summary.releases)
    chips.push({
      label: summary.releases === 1 ? "release" : "releases",
      count: summary.releases,
      tone: "text-(--blue-11)",
    });
  if (chips.length === 0) return null;
  return (
    <Flex gap="5" wrap="wrap" className="px-3 py-2">
      {chips.map((c) => (
        <Flex key={c.label} align="baseline" gap="2">
          <Text
            as="span"
            weight="medium"
            className={`${c.tone} text-[13px] tabular-nums`}
          >
            {c.count}
          </Text>
          <Text as="span" className="text-(--gray-10) text-[11px]">
            {c.label}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}

function ActivityCard({ project }: { project: Project }) {
  const repo = project.githubRepo;
  if (!project.activity?.length && !repo) return null;
  const repoLabel = repo ? `${repo.owner}/${repo.name}` : null;
  return (
    <Box>
      <SectionHeader
        icon={<GitBranch size={14} weight="duotone" />}
        title="GitHub activity · last 24h"
        action={
          repoLabel && repo ? (
            <button
              type="button"
              onClick={() => openUrlInBrowser(repo.url)}
              className="flex items-center gap-1 text-(--gray-10) text-[11px] hover:text-(--gray-12)"
            >
              {repoLabel}
              <ArrowSquareOut size={10} weight="bold" />
            </button>
          ) : undefined
        }
      />
      <Box className="overflow-hidden rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1)">
        {repo?.summary && (
          <Box className="border-(--gray-4) border-b">
            <GitHubSummaryChips summary={repo.summary} />
          </Box>
        )}
        {project.activity?.map((e, i) => (
          <button
            type="button"
            key={e.id}
            onClick={() => e.url && openUrlInBrowser(e.url)}
            disabled={!e.url}
            className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
              e.url ? "hover:bg-(--gray-2)" : "cursor-default"
            } ${i > 0 || repo?.summary ? "border-(--gray-4) border-t" : ""}`}
          >
            <Box className={`mt-0.5 ${ACTIVITY_ICON_TONE[e.kind]}`}>
              {ACTIVITY_ICON[e.kind]}
            </Box>
            <Box className="min-w-0 flex-1">
              <Text
                as="div"
                className="line-clamp-2 text-(--gray-12) text-[12px]"
              >
                {e.text}
              </Text>
              {e.actor && (
                <Text as="div" className="text-(--gray-10) text-[11px]">
                  {e.actor}
                </Text>
              )}
            </Box>
            <Text as="span" className="shrink-0 text-(--gray-10) text-[11px]">
              {e.when}
            </Text>
          </button>
        ))}
      </Box>
    </Box>
  );
}

function PinnedSkillsCard({ project }: { project: Project }) {
  const skills = useWorkSkillsStore((s) => s.skills);
  const navigateToWorkSkill = useNavigationStore((s) => s.navigateToWorkSkill);

  if (!project.pinnedSkills?.length) return null;

  return (
    <Box>
      <SectionHeader
        icon={<Lightbulb size={14} weight="duotone" />}
        title="Frequently used skills"
        count={project.pinnedSkills.length}
      />
      <Flex direction="column" gap="1.5">
        {project.pinnedSkills.map((name) => {
          const match = skills.find(
            (s) => s.name.toLowerCase() === name.toLowerCase(),
          );
          const onClick = match
            ? () => navigateToWorkSkill(match.id)
            : undefined;
          const baseClasses =
            "flex w-full items-center gap-2 rounded-(--radius-2) border border-(--gray-5) bg-(--gray-1) px-3 py-2 text-left";
          const interactiveClasses = match
            ? "cursor-pointer transition-colors hover:border-(--gray-7) hover:bg-(--gray-2)"
            : "cursor-default";
          return (
            <button
              key={name}
              type="button"
              onClick={onClick}
              disabled={!match}
              className={`${baseClasses} ${interactiveClasses}`}
              title={
                match
                  ? `Open "${match.name}" in the skills library`
                  : "Not in your skills library yet"
              }
            >
              <Lightbulb
                size={13}
                weight="regular"
                className="shrink-0 text-(--gray-10)"
              />
              <Text
                as="span"
                className={`flex-1 truncate text-[12px] ${
                  match ? "text-(--gray-12)" : "text-(--gray-11)"
                }`}
              >
                {name}
              </Text>
              {!match && (
                <Text as="span" className="text-(--gray-9) text-[11px]">
                  Not added
                </Text>
              )}
            </button>
          );
        })}
      </Flex>
    </Box>
  );
}

interface WidgetMeta {
  title: string;
  render: (project: Project) => ReactNode;
  isEmpty: (project: Project) => boolean;
}

const WIDGET_REGISTRY: Record<ProjectWidgetId, WidgetMeta> = {
  headline: {
    title: "Headline metric",
    render: (project) =>
      project.headline ? <HeadlineCard headline={project.headline} /> : null,
    isEmpty: (project) => !project.headline,
  },
  activity: {
    title: "GitHub activity",
    render: (project) => <ActivityCard project={project} />,
    isEmpty: (project) => !project.activity?.length && !project.githubRepo,
  },
  dashboards: {
    title: "Dashboards",
    render: (project) => <DashboardsCard project={project} />,
    isEmpty: (project) => !project.dashboards?.length,
  },
  automations: {
    title: "Automations",
    render: (project) => <AutomationsCard project={project} />,
    isEmpty: (project) => !project.automations?.length,
  },
  files: {
    title: "Files",
    render: (project) => <FilesCard project={project} />,
    isEmpty: (project) => !project.files?.length,
  },
  pinnedSkills: {
    title: "Frequently used skills",
    render: (project) => <PinnedSkillsCard project={project} />,
    isEmpty: (project) => !project.pinnedSkills?.length,
  },
};

function WidgetShell({
  title,
  isEditing,
  onHide,
  children,
}: {
  title: string;
  isEditing: boolean;
  onHide: () => void;
  children: ReactNode;
}) {
  return (
    <Box
      className={`flex h-full w-full flex-col overflow-hidden ${
        isEditing
          ? "rounded-(--radius-3) border border-(--gray-6) border-dashed bg-(--gray-1)/40"
          : ""
      }`}
    >
      {isEditing && (
        <Flex
          align="center"
          justify="between"
          gap="2"
          className="widget-drag-handle shrink-0 cursor-grab border-(--gray-5) border-b bg-(--gray-2) px-2 py-1 active:cursor-grabbing"
        >
          <Flex align="center" gap="1.5" className="min-w-0 text-(--gray-11)">
            <ArrowsOutCardinal size={11} weight="bold" />
            <Text
              as="span"
              className="truncate text-(--gray-11) text-[11px] uppercase tracking-wide"
            >
              {title}
            </Text>
          </Flex>
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onHide}
            title="Hide widget"
            aria-label={`Hide ${title}`}
            className="flex h-5 w-5 items-center justify-center rounded-(--radius-1) text-(--gray-10) hover:bg-(--gray-3) hover:text-(--gray-12)"
          >
            <X size={11} weight="bold" />
          </button>
        </Flex>
      )}
      <Box
        className={`min-h-0 flex-1 overflow-y-auto ${isEditing ? "p-2" : ""}`}
      >
        {children}
      </Box>
    </Box>
  );
}

function ProjectWidgetsGrid({
  project,
  isEditing,
}: {
  project: Project;
  isEditing: boolean;
}) {
  const projectId = project.id;
  const stored = useProjectLayoutStore((s) => s.layoutsByProjectId[projectId]);
  const setBreakpointLayout = useProjectLayoutStore(
    (s) => s.setBreakpointLayout,
  );
  const hideWidget = useProjectLayoutStore((s) => s.hideWidget);

  const hidden = stored?.hidden ?? [];

  const visibleIds = useMemo(
    () =>
      PROJECT_WIDGET_IDS.filter((id) => {
        if (hidden.includes(id)) return false;
        if (!isEditing && WIDGET_REGISTRY[id].isEmpty(project)) return false;
        return true;
      }),
    [hidden, isEditing, project],
  );

  const layouts = useMemo(() => {
    const breakpoints: ProjectGridBreakpoint[] = ["lg", "md", "sm"];
    const result: Partial<Record<ProjectGridBreakpoint, Layout>> = {};
    for (const bp of breakpoints) {
      const saved = stored?.layouts[bp];
      result[bp] = visibleIds.map((id) => {
        const rect = saved?.[id] ?? DEFAULT_PROJECT_LAYOUT[bp][id];
        return {
          i: id,
          x: rect.x,
          y: rect.y,
          w: rect.w,
          h: rect.h,
          minW: 3,
          minH: 3,
        };
      });
    }
    return result as Record<ProjectGridBreakpoint, Layout>;
  }, [stored, visibleIds]);

  const handleLayoutChange = useCallback(
    (_current: Layout, all: Partial<Record<string, Layout>>) => {
      if (!isEditing) return;
      for (const bp of ["lg", "md", "sm"] as ProjectGridBreakpoint[]) {
        const items = all[bp];
        if (!items) continue;
        const next: Record<
          ProjectWidgetId,
          { x: number; y: number; w: number; h: number }
        > = { ...DEFAULT_PROJECT_LAYOUT[bp] };
        for (const item of items) {
          const id = item.i as ProjectWidgetId;
          if (!PROJECT_WIDGET_IDS.includes(id)) continue;
          next[id] = { x: item.x, y: item.y, w: item.w, h: item.h };
        }
        setBreakpointLayout(projectId, bp, next);
      }
    },
    [isEditing, projectId, setBreakpointLayout],
  );

  if (visibleIds.length === 0) {
    return (
      <Box className="rounded-(--radius-3) border border-(--gray-5) border-dashed bg-(--gray-1) p-6 text-center">
        <Text as="div" className="text-(--gray-10) text-[12px]">
          No widgets to show. Use Customize to bring widgets back.
        </Text>
      </Box>
    );
  }

  return (
    <ResponsiveGridLayout
      className="layout"
      layouts={layouts}
      breakpoints={PROJECT_GRID_BREAKPOINTS}
      cols={PROJECT_GRID_COLS}
      rowHeight={PROJECT_GRID_ROW_HEIGHT}
      margin={[16, 16]}
      containerPadding={[0, 0]}
      isDraggable={isEditing}
      isResizable={isEditing}
      draggableHandle=".widget-drag-handle"
      compactType="vertical"
      preventCollision={false}
      onLayoutChange={handleLayoutChange}
    >
      {visibleIds.map((id) => {
        const meta = WIDGET_REGISTRY[id];
        const content = meta.render(project);
        const empty = meta.isEmpty(project);
        return (
          <div key={id}>
            <WidgetShell
              title={meta.title}
              isEditing={isEditing}
              onHide={() => hideWidget(projectId, id)}
            >
              {empty && isEditing ? (
                <Flex
                  align="center"
                  justify="center"
                  className="h-full w-full p-3 text-center"
                >
                  <Text as="span" className="text-(--gray-10) text-[12px]">
                    No data yet
                  </Text>
                </Flex>
              ) : (
                content
              )}
            </WidgetShell>
          </div>
        );
      })}
    </ResponsiveGridLayout>
  );
}

function HiddenWidgetsTray({ projectId }: { projectId: string }) {
  const hidden = useProjectLayoutStore(
    (s) => s.layoutsByProjectId[projectId]?.hidden ?? [],
  );
  const showWidget = useProjectLayoutStore((s) => s.showWidget);
  const resetLayout = useProjectLayoutStore((s) => s.resetLayout);

  return (
    <Flex
      align="center"
      gap="2"
      wrap="wrap"
      className="rounded-(--radius-3) border border-(--gray-5) border-dashed bg-(--gray-2) px-3 py-2"
    >
      <Text
        as="span"
        className="text-(--gray-11) text-[11px] uppercase tracking-wide"
      >
        Hidden widgets
      </Text>
      {hidden.length === 0 ? (
        <Text as="span" className="text-(--gray-10) text-[11px]">
          None – everything is on the board.
        </Text>
      ) : (
        hidden.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => showWidget(projectId, id)}
            className="flex items-center gap-1 rounded-(--radius-2) border border-(--gray-5) bg-(--gray-1) px-2 py-1 text-(--gray-12) text-[11px] hover:border-(--gray-7) hover:bg-(--gray-3)"
          >
            <Plus size={10} weight="bold" />
            {WIDGET_REGISTRY[id].title}
          </button>
        ))
      )}
      <Box className="ml-auto">
        <button
          type="button"
          onClick={() => resetLayout(projectId)}
          className="flex items-center gap-1 text-(--gray-10) text-[11px] hover:text-(--gray-12)"
          title="Reset layout to defaults"
        >
          <ArrowsCounterClockwise size={10} weight="bold" />
          Reset layout
        </button>
      </Box>
    </Flex>
  );
}

const MIN_CONTENT_WIDTH = 360;
const MIN_PANEL_WIDTH = 360;
const DEFAULT_PANEL_WIDTH = 440;

export function WorkProjectDetailView() {
  const projectId = useNavigationStore((s) => s.workSelectedProjectId);
  const navigateToWorkProjects = useNavigationStore(
    (s) => s.navigateToWorkProjects,
  );

  const baseProject = useMemo(
    () => (projectId ? getProject(projectId) : undefined),
    [projectId],
  );

  const edit = useProjectEditsStore((s) =>
    projectId ? s.editsByProjectId[projectId] : undefined,
  );
  const patchEdit = useProjectEditsStore((s) => s.patchEdit);

  const project = useMemo(
    () => (baseProject ? { ...baseProject, ...(edit ?? {}) } : undefined),
    [baseProject, edit],
  );

  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [isEditingLayout, setIsEditingLayout] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  const startEditing = useCallback(() => {
    setNameDraft(project?.name ?? "");
    setDescDraft(project?.description ?? "");
    setIsEditingMeta(true);
  }, [project]);

  const commitAndExit = useCallback(() => {
    if (!projectId || !project) return;
    const trimmedName = nameDraft.trim();
    const trimmedDesc = descDraft.trim();
    const patch: { name?: string; description?: string } = {};
    if (trimmedName && trimmedName !== project.name) patch.name = trimmedName;
    if (trimmedDesc && trimmedDesc !== project.description)
      patch.description = trimmedDesc;
    if (Object.keys(patch).length > 0) patchEdit(projectId, patch);
    setIsEditingMeta(false);
  }, [projectId, project, nameDraft, descDraft, patchEdit]);

  const cancelEditing = useCallback(() => {
    setIsEditingMeta(false);
  }, []);

  useEffect(() => {
    if (isEditingMeta) {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    }
  }, [isEditingMeta]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [panelWidth, setPanelWidth] = useState<number>(DEFAULT_PANEL_WIDTH);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const startX = e.clientX;
      const startWidth = panelWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = startX - moveEvent.clientX;
        const maxWidth = Math.max(
          MIN_PANEL_WIDTH,
          containerRect.width - MIN_CONTENT_WIDTH,
        );
        const newWidth = Math.min(
          maxWidth,
          Math.max(MIN_PANEL_WIDTH, startWidth + delta),
        );
        setPanelWidth(newWidth);
      };

      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [panelWidth],
  );

  if (!project) {
    return (
      <Box className="flex h-full w-full items-center justify-center">
        <Text as="div" className="text-(--gray-11) text-[13px]">
          Project not found.{" "}
          <button
            type="button"
            onClick={navigateToWorkProjects}
            className="text-(--gray-12) underline underline-offset-2"
          >
            Back to projects
          </button>
        </Text>
      </Box>
    );
  }

  const Icon = getProjectIcon(project.iconId);

  return (
    <Box height="100%" ref={containerRef}>
      <Flex height="100%">
        <Box className="scrollbar-overlay-y min-w-0 flex-1 overflow-y-auto">
          <Flex
            direction="column"
            gap="5"
            className="mx-auto w-full max-w-[920px] px-6 pt-8 pb-12"
          >
            <Flex direction="column" gap="3">
              <button
                type="button"
                onClick={navigateToWorkProjects}
                className="-ml-1 flex w-fit items-center gap-1 text-(--gray-10) text-[12px] transition-colors hover:text-(--gray-12)"
              >
                <ArrowLeft size={12} weight="bold" />
                Projects
              </button>

              <Flex align="start" justify="between" gap="3">
                <Flex align="center" gap="3" className="min-w-0">
                  <Flex
                    align="center"
                    justify="center"
                    className="h-11 w-11 shrink-0 rounded-(--radius-2) bg-(--gray-3) text-(--gray-11)"
                  >
                    <Icon size={22} weight="regular" />
                  </Flex>
                  <Box className="min-w-0 flex-1">
                    {isEditingMeta ? (
                      <input
                        ref={nameInputRef}
                        value={nameDraft}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitAndExit();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelEditing();
                          }
                        }}
                        className="-mx-2 block w-full rounded-(--radius-2) bg-(--gray-2) px-2 py-1 font-medium text-(--gray-12) text-[22px] outline-none ring-(--accent-7) ring-1 focus:ring-(--accent-8) focus:ring-2"
                      />
                    ) : (
                      <Text
                        as="div"
                        weight="medium"
                        className="text-(--gray-12) text-[22px] leading-tight"
                      >
                        {project.name}
                      </Text>
                    )}
                    <Text as="div" className="text-(--gray-11) text-[12px]">
                      {project.tagline}
                    </Text>
                  </Box>
                </Flex>
                <Flex align="center" gap="2">
                  {project.headline?.posthogUrl && !isEditingMeta && (
                    <button
                      type="button"
                      onClick={() =>
                        project.headline &&
                        openUrlInBrowser(project.headline.posthogUrl)
                      }
                      className="flex h-8 items-center gap-1.5 rounded-(--radius-2) border border-(--gray-5) bg-(--gray-1) px-3 text-(--gray-11) text-[12px] transition-colors hover:border-(--gray-7) hover:bg-(--gray-2) hover:text-(--gray-12)"
                    >
                      Open in PostHog
                      <ArrowSquareOut size={11} weight="bold" />
                    </button>
                  )}
                  {!isEditingMeta && (
                    <button
                      type="button"
                      onClick={() => setIsEditingLayout((v) => !v)}
                      title={
                        isEditingLayout
                          ? "Done customizing"
                          : "Customize layout"
                      }
                      aria-label={
                        isEditingLayout
                          ? "Done customizing layout"
                          : "Customize layout"
                      }
                      className={`flex h-8 items-center gap-1.5 rounded-(--radius-2) border px-3 text-[12px] transition-colors ${
                        isEditingLayout
                          ? "border-(--accent-7) bg-(--accent-3) text-(--accent-11) hover:bg-(--accent-4)"
                          : "border-(--gray-5) bg-(--gray-1) text-(--gray-11) hover:border-(--gray-7) hover:bg-(--gray-2) hover:text-(--gray-12)"
                      }`}
                    >
                      {isEditingLayout ? (
                        <>
                          <Check size={12} weight="bold" />
                          Done
                        </>
                      ) : (
                        <>
                          <PencilSimple size={12} weight="bold" />
                          Customize
                        </>
                      )}
                    </button>
                  )}
                  {isEditingMeta && (
                    <button
                      type="button"
                      onClick={cancelEditing}
                      className="flex h-8 items-center gap-1.5 rounded-(--radius-2) border border-(--gray-5) bg-(--gray-1) px-3 text-(--gray-11) text-[12px] transition-colors hover:border-(--gray-7) hover:bg-(--gray-2) hover:text-(--gray-12)"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={isEditingMeta ? commitAndExit : startEditing}
                    title={isEditingMeta ? "Done" : "Edit details"}
                    aria-label={isEditingMeta ? "Done editing" : "Edit details"}
                    className={`flex h-8 w-8 items-center justify-center rounded-(--radius-2) border transition-colors ${
                      isEditingMeta
                        ? "border-(--accent-7) bg-(--accent-3) text-(--accent-11) hover:bg-(--accent-4)"
                        : "border-(--gray-5) bg-(--gray-1) text-(--gray-11) hover:border-(--gray-7) hover:bg-(--gray-2) hover:text-(--gray-12)"
                    }`}
                  >
                    {isEditingMeta ? (
                      <Check size={16} weight="bold" />
                    ) : (
                      <DotsThree size={16} weight="bold" />
                    )}
                  </button>
                </Flex>
              </Flex>

              {isEditingMeta ? (
                <textarea
                  value={descDraft}
                  onChange={(e) => setDescDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      commitAndExit();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelEditing();
                    }
                  }}
                  rows={6}
                  className="block w-full resize-y rounded-(--radius-2) bg-(--gray-2) p-3 text-(--gray-12) text-[13px] leading-relaxed outline-none ring-(--accent-7) ring-1 focus:ring-(--accent-8) focus:ring-2"
                />
              ) : (
                <Text
                  as="div"
                  className="max-w-[640px] whitespace-pre-wrap text-(--gray-11) text-[13px]"
                >
                  {project.description}
                </Text>
              )}

              <Flex align="center" gap="3" wrap="wrap">
                <Flex align="center" gap="-1">
                  {project.members.map((m, i) => (
                    <Box
                      key={m.name}
                      title={m.name}
                      className="-ml-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-(--gray-1) bg-(--gray-4) text-(--gray-12) text-[10px] first:ml-0"
                      style={{ zIndex: project.members.length - i }}
                    >
                      {m.initials}
                    </Box>
                  ))}
                </Flex>
                <Text as="span" className="text-(--gray-10) text-[11px]">
                  {project.members.length} collaborators ·{" "}
                  {project.updatedLabel}
                </Text>
              </Flex>
            </Flex>

            <ProjectWidgetsGrid project={project} isEditing={isEditingLayout} />

            {isEditingLayout && <HiddenWidgetsTray projectId={project.id} />}
          </Flex>
        </Box>

        <Box
          onMouseDown={handleResizeStart}
          className="z-[1] w-[4px] shrink-0 cursor-col-resize border-l border-l-(--gray-6) bg-transparent transition-colors hover:bg-accent-6 active:bg-accent-8"
        />

        <Box
          style={{ width: `${panelWidth}px` }}
          className="h-full shrink-0 bg-(--gray-1)"
        >
          <ProjectChatPanel project={project} />
        </Box>
      </Flex>
    </Box>
  );
}
