import { useAuthenticatedQuery } from "@hooks/useAuthenticatedQuery";
import {
  ChatCircleText,
  Flag,
  Lightning,
  MagnifyingGlass,
  Palette,
  Play,
  TestTube,
  User,
  XIcon,
} from "@phosphor-icons/react";
import { Box, Dialog, Flex, Text, TextField } from "@radix-ui/themes";
import type { Schemas } from "@renderer/api/generated";
import type {
  PaginatedRenderingCanvases,
  RenderingCanvas,
} from "@renderer/api/posthogClient";
import { useNavigationStore } from "@stores/navigationStore";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { useAnalysisSearchStore } from "../store";

type CategoryKey =
  | "surveys"
  | "canvases"
  | "feature_flags"
  | "experiments"
  | "events"
  | "persons"
  | "replays";

interface CategoryMeta {
  key: CategoryKey;
  label: string;
  icon: React.ReactNode;
}

const CATEGORIES: CategoryMeta[] = [
  { key: "surveys", label: "Surveys", icon: <ChatCircleText size={14} /> },
  { key: "canvases", label: "Canvas", icon: <Palette size={14} /> },
  { key: "feature_flags", label: "Feature flags", icon: <Flag size={14} /> },
  { key: "experiments", label: "Experiments", icon: <TestTube size={14} /> },
  { key: "events", label: "Events", icon: <Lightning size={14} /> },
  { key: "persons", label: "Persons", icon: <User size={14} /> },
  { key: "replays", label: "Replays", icon: <Play size={14} /> },
];

export function AnalysisSearchModal() {
  const isOpen = useAnalysisSearchStore((s) => s.isOpen);
  const setOpen = useAnalysisSearchStore((s) => s.setOpen);
  const close = useAnalysisSearchStore((s) => s.close);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("surveys");

  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={setOpen}>
      <Dialog.Content className="flex h-[90vh]! max-h-[90vh]! w-[90vw]! max-w-[90vw]! flex-col gap-0 p-0">
        <Dialog.Title className="sr-only">Explore</Dialog.Title>

        <Box className="shrink-0 border-(--gray-5) border-b p-3">
          <TextField.Root
            size="3"
            placeholder={`Explore ${labelFor(activeCategory).toLowerCase()}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          >
            <TextField.Slot>
              <MagnifyingGlass size={16} />
            </TextField.Slot>
            <TextField.Slot>
              <Dialog.Close>
                <button
                  type="button"
                  className="rounded p-1 text-gray-11 hover:bg-gray-3 hover:text-gray-12"
                  aria-label="Close"
                >
                  <XIcon size={14} />
                </button>
              </Dialog.Close>
            </TextField.Slot>
          </TextField.Root>
        </Box>

        <CategoryTabs
          active={activeCategory}
          onChange={setActiveCategory}
          query={query}
        />

        <Box className="min-h-0 flex-1 overflow-auto">
          <CategoryTable
            category={activeCategory}
            query={query.trim()}
            onSelect={close}
          />
        </Box>
      </Dialog.Content>
    </Dialog.Root>
  );
}

function labelFor(key: CategoryKey): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? "items";
}

function CategoryTabs({
  active,
  onChange,
  query,
}: {
  active: CategoryKey;
  onChange: (k: CategoryKey) => void;
  query: string;
}) {
  const counts = useCategoryCounts(query);

  return (
    <Flex
      gap="1"
      className="shrink-0 overflow-x-auto border-(--gray-5) border-b px-2 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {CATEGORIES.map((cat) => {
        const isActive = cat.key === active;
        const count = counts[cat.key];
        return (
          <button
            key={cat.key}
            type="button"
            onClick={() => onChange(cat.key)}
            className={`flex shrink-0 items-center gap-2 rounded-(--radius-2) px-3 py-1.5 transition-colors ${
              isActive
                ? "bg-(--accent-3) text-(--accent-11)"
                : "text-(--gray-11) hover:bg-(--gray-3) hover:text-(--gray-12)"
            }`}
          >
            {cat.icon}
            <Text size="2" weight="medium">
              {cat.label}
            </Text>
            <Text
              size="1"
              className={`rounded-(--radius-1) px-1.5 py-0.5 font-mono ${
                isActive
                  ? "bg-(--accent-9) text-white"
                  : "bg-(--gray-3) text-(--gray-11)"
              }`}
            >
              {count ?? "…"}
            </Text>
          </button>
        );
      })}
    </Flex>
  );
}

function useCategoryCounts(
  query: string,
): Partial<Record<CategoryKey, string>> {
  const surveys = useSurveys();
  const canvases = useCanvases();
  const flags = useFlags();
  const experiments = useExperiments();
  const events = useEvents(query);
  const persons = usePersons(query);
  const replays = useReplays();

  return {
    surveys: formatCount(surveys.data?.count, surveys.data?.results?.length),
    canvases: formatCount(canvases.data?.count, canvases.data?.results?.length),
    feature_flags: formatCount(flags.data?.count, flags.data?.results?.length),
    experiments: formatCount(
      experiments.data?.count,
      experiments.data?.results?.length,
    ),
    events: formatCount(undefined, events.data?.results?.length, true),
    persons: formatCount(persons.data?.count, persons.data?.results?.length),
    replays: formatCount(replays.data?.count, replays.data?.results?.length),
  };
}

function formatCount(
  count: number | undefined,
  fallbackLen: number | undefined,
  approx?: boolean,
): string {
  const n = count ?? fallbackLen;
  if (n == null) return "…";
  const suffix = approx && n >= 100 ? "+" : "";
  if (n >= 1000) {
    return `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k${suffix}`;
  }
  return `${n}${suffix}`;
}

function useSurveys() {
  return useAuthenticatedQuery<Schemas.PaginatedSurveyList>(
    ["analysis-search", "surveys"],
    (c) => c.listSurveys({ limit: 100 }),
    { staleTime: 60_000 },
  );
}
function useCanvases() {
  return useAuthenticatedQuery<PaginatedRenderingCanvases>(
    ["analysis-search", "canvases"],
    (c) => c.listRenderingCanvases(),
    { staleTime: 60_000 },
  );
}
function useFlags() {
  return useAuthenticatedQuery<Schemas.PaginatedFeatureFlagList>(
    ["analysis-search", "feature_flags"],
    (c) => c.listFeatureFlags({ limit: 100 }),
    { staleTime: 60_000 },
  );
}
function useExperiments() {
  return useAuthenticatedQuery<Schemas.PaginatedExperimentList>(
    ["analysis-search", "experiments"],
    (c) => c.listExperiments({ limit: 100 }),
    { staleTime: 60_000 },
  );
}
function useEvents(query: string) {
  return useAuthenticatedQuery<Schemas.PaginatedClickhouseEventList>(
    ["analysis-search", "events", query],
    (c) => c.listEvents({ limit: 100, event: query || undefined }),
    { staleTime: 30_000 },
  );
}
function usePersons(query: string) {
  return useAuthenticatedQuery<Schemas.PaginatedPersonRecordList>(
    ["analysis-search", "persons", query],
    (c) => c.listPersons({ limit: 100, search: query || undefined }),
    { staleTime: 30_000 },
  );
}
function useReplays() {
  return useAuthenticatedQuery<Schemas.PaginatedSessionRecordingList>(
    ["analysis-search", "replays"],
    (c) => c.listSessionRecordings({ limit: 100 }),
    { staleTime: 30_000 },
  );
}

function CategoryTable({
  category,
  query,
  onSelect,
}: {
  category: CategoryKey;
  query: string;
  onSelect: () => void;
}) {
  if (category === "surveys") return <SurveysTable query={query} />;
  if (category === "canvases")
    return <CanvasesTable query={query} onSelect={onSelect} />;
  if (category === "feature_flags") return <FeatureFlagsTable query={query} />;
  if (category === "experiments") return <ExperimentsTable query={query} />;
  if (category === "events") return <EventsTable query={query} />;
  if (category === "replays") return <ReplaysTable query={query} />;
  return <PersonsTable query={query} />;
}

interface Column {
  label: string;
  className?: string;
}

function Table({
  columns,
  isLoading,
  error,
  emptyMessage,
  itemCount,
  children,
}: {
  columns: Column[];
  isLoading: boolean;
  error: Error | null;
  emptyMessage: string;
  itemCount: number;
  children: React.ReactNode;
}) {
  return (
    <Box className="w-full">
      <Box className="sticky top-0 z-1 border-(--gray-5) border-b bg-(--gray-2)">
        <Flex gap="3" px="4" py="2">
          {columns.map((c) => (
            <Text
              key={c.label}
              size="1"
              weight="medium"
              className={`text-(--gray-11) uppercase tracking-wide ${c.className ?? ""}`}
            >
              {c.label}
            </Text>
          ))}
        </Flex>
      </Box>
      {isLoading ? (
        <StatusRow message="Loading…" />
      ) : error ? (
        <StatusRow message={`Failed to load: ${error.message}`} />
      ) : itemCount === 0 ? (
        <StatusRow message={emptyMessage} />
      ) : (
        children
      )}
    </Box>
  );
}

function StatusRow({ message }: { message: string }) {
  return (
    <Flex align="center" justify="center" className="h-32">
      <Text size="2" className="text-(--gray-11)">
        {message}
      </Text>
    </Flex>
  );
}

function Row({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <Flex
      gap="3"
      px="4"
      py="2"
      align="center"
      onClick={onClick}
      className={`border-(--gray-5) border-b transition-colors ${
        onClick ? "cursor-pointer hover:bg-(--gray-2)" : ""
      }`}
    >
      {children}
    </Flex>
  );
}

function matches(haystack: Array<string | null | undefined>, q: string) {
  if (!q) return true;
  const ql = q.toLowerCase();
  return haystack.some((v) => v?.toLowerCase().includes(ql));
}

function timestampOrZero(iso?: string | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "—";
  return new Date(t).toLocaleString();
}

function SurveysTable({ query }: { query: string }) {
  const { data, isLoading, error } = useSurveys();
  const rows = useMemo(() => {
    const all = data?.results ?? [];
    return [...all]
      .filter((s) => matches([s.name, s.description], query))
      .sort(
        (a, b) => timestampOrZero(b.created_at) - timestampOrZero(a.created_at),
      );
  }, [data, query]);

  return (
    <Table
      columns={[
        { label: "Name", className: "flex-1" },
        { label: "Created", className: "w-48 shrink-0" },
      ]}
      isLoading={isLoading}
      error={error}
      emptyMessage={query ? `No surveys matching "${query}".` : "No surveys."}
      itemCount={rows.length}
    >
      {rows.map((s) => (
        <Row key={s.id}>
          <Flex direction="column" gap="1" className="min-w-0 flex-1">
            <Text
              size="2"
              weight="medium"
              className="truncate text-(--gray-12)"
            >
              {s.name}
            </Text>
            {s.description && (
              <Text size="1" className="truncate text-(--gray-11)">
                {s.description}
              </Text>
            )}
          </Flex>
          <Text size="1" className="w-48 shrink-0 text-(--gray-10)">
            {formatDate(s.created_at)}
          </Text>
        </Row>
      ))}
    </Table>
  );
}

function CanvasesTable({
  query,
  onSelect,
}: {
  query: string;
  onSelect: () => void;
}) {
  const { data, isLoading, error } = useCanvases();
  const navigateToCanvasInput = useNavigationStore(
    (s) => s.navigateToCanvasInput,
  );
  const rows = useMemo<RenderingCanvas[]>(() => {
    const all = data?.results ?? [];
    return [...all]
      .filter((c) => matches([c.name, c.path], query))
      .sort(
        (a, b) => timestampOrZero(b.updated_at) - timestampOrZero(a.updated_at),
      );
  }, [data, query]);

  return (
    <Table
      columns={[
        { label: "Name", className: "flex-1" },
        { label: "Path", className: "w-64 shrink-0" },
        { label: "Updated", className: "w-48 shrink-0" },
      ]}
      isLoading={isLoading}
      error={error}
      emptyMessage={query ? `No canvases matching "${query}".` : "No canvases."}
      itemCount={rows.length}
    >
      {rows.map((c) => (
        <Row
          key={c.id}
          onClick={() => {
            navigateToCanvasInput(c.id);
            onSelect();
          }}
        >
          <Text
            size="2"
            weight="medium"
            className="flex-1 truncate text-(--gray-12)"
          >
            {c.name}
          </Text>
          <Text
            size="1"
            className="w-64 shrink-0 truncate font-mono text-(--gray-11)"
          >
            {c.path}
          </Text>
          <Text size="1" className="w-48 shrink-0 text-(--gray-10)">
            {formatDate(c.updated_at)}
          </Text>
        </Row>
      ))}
    </Table>
  );
}

function FeatureFlagsTable({ query }: { query: string }) {
  const { data, isLoading, error } = useFlags();
  const rows = useMemo(() => {
    const all = data?.results ?? [];
    return [...all]
      .filter((f) => matches([f.name, f.key], query))
      .sort(
        (a, b) => timestampOrZero(b.created_at) - timestampOrZero(a.created_at),
      );
  }, [data, query]);

  return (
    <Table
      columns={[
        { label: "Name", className: "flex-1" },
        { label: "Key", className: "w-72 shrink-0" },
        { label: "Status", className: "w-24 shrink-0" },
        { label: "Created", className: "w-48 shrink-0" },
      ]}
      isLoading={isLoading}
      error={error}
      emptyMessage={
        query ? `No flags matching "${query}".` : "No feature flags."
      }
      itemCount={rows.length}
    >
      {rows.map((f) => (
        <Row key={f.id}>
          <Text
            size="2"
            weight="medium"
            className="flex-1 truncate text-(--gray-12)"
          >
            {f.name?.trim() || f.key}
          </Text>
          <Text
            size="1"
            className="w-72 shrink-0 truncate font-mono text-(--gray-11)"
          >
            {f.key}
          </Text>
          <Text
            size="1"
            className={`w-24 shrink-0 truncate rounded-(--radius-1) px-1.5 py-0.5 ${
              f.active
                ? "bg-(--green-3) text-(--green-11)"
                : "bg-(--gray-3) text-(--gray-11)"
            }`}
          >
            {f.active ? "Active" : "Inactive"}
          </Text>
          <Text size="1" className="w-48 shrink-0 text-(--gray-10)">
            {formatDate(f.created_at)}
          </Text>
        </Row>
      ))}
    </Table>
  );
}

function ExperimentsTable({ query }: { query: string }) {
  const { data, isLoading, error } = useExperiments();
  const rows = useMemo(() => {
    const all = data?.results ?? [];
    return [...all]
      .filter((e) => matches([e.name, e.description], query))
      .sort(
        (a, b) =>
          timestampOrZero(b.start_date ?? b.created_at) -
          timestampOrZero(a.start_date ?? a.created_at),
      );
  }, [data, query]);

  return (
    <Table
      columns={[
        { label: "Name", className: "flex-1" },
        { label: "Status", className: "w-32 shrink-0" },
        { label: "Started", className: "w-48 shrink-0" },
      ]}
      isLoading={isLoading}
      error={error}
      emptyMessage={
        query ? `No experiments matching "${query}".` : "No experiments."
      }
      itemCount={rows.length}
    >
      {rows.map((e) => (
        <Row key={e.id}>
          <Flex direction="column" gap="1" className="min-w-0 flex-1">
            <Text
              size="2"
              weight="medium"
              className="truncate text-(--gray-12)"
            >
              {e.name}
            </Text>
            {e.description && (
              <Text size="1" className="truncate text-(--gray-11)">
                {e.description}
              </Text>
            )}
          </Flex>
          <Text size="1" className="w-32 shrink-0 truncate text-(--gray-11)">
            {e.status ?? "—"}
          </Text>
          <Text size="1" className="w-48 shrink-0 text-(--gray-10)">
            {formatDate(e.start_date ?? e.created_at)}
          </Text>
        </Row>
      ))}
    </Table>
  );
}

function EventsTable({ query }: { query: string }) {
  const { data, isLoading, error } = useEvents(query);
  const rows = data?.results ?? [];

  return (
    <Table
      columns={[
        { label: "Event", className: "w-64 shrink-0" },
        { label: "Distinct ID", className: "flex-1" },
        { label: "Time", className: "w-48 shrink-0" },
      ]}
      isLoading={isLoading}
      error={error}
      emptyMessage={query ? `No events matching "${query}".` : "No events."}
      itemCount={rows.length}
    >
      {rows.map((e) => (
        <Row key={e.id}>
          <Text
            size="2"
            weight="medium"
            className="w-64 shrink-0 truncate font-mono text-(--gray-12)"
          >
            {e.event}
          </Text>
          <Text
            size="1"
            className="flex-1 truncate font-mono text-(--gray-11)"
            title={e.distinct_id}
          >
            {e.distinct_id}
          </Text>
          <Text size="1" className="w-48 shrink-0 text-(--gray-10)">
            {formatDate(e.timestamp)}
          </Text>
        </Row>
      ))}
    </Table>
  );
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function ReplaysTable({ query }: { query: string }) {
  const { data, isLoading, error } = useReplays();
  const rows = useMemo(() => {
    const all = data?.results ?? [];
    return [...all]
      .filter((r) =>
        matches(
          [
            r.id,
            r.distinct_id,
            r.start_url,
            r.person?.name,
            r.person?.distinct_ids?.[0],
          ],
          query,
        ),
      )
      .sort(
        (a, b) => timestampOrZero(b.start_time) - timestampOrZero(a.start_time),
      );
  }, [data, query]);

  return (
    <Table
      columns={[
        { label: "Person", className: "flex-1" },
        { label: "Start URL", className: "w-64 shrink-0" },
        { label: "Duration", className: "w-24 shrink-0" },
        { label: "Started", className: "w-48 shrink-0" },
      ]}
      isLoading={isLoading}
      error={error}
      emptyMessage={query ? `No replays matching "${query}".` : "No replays."}
      itemCount={rows.length}
    >
      {rows.map((r) => {
        const personLabel =
          r.person?.name ||
          r.person?.distinct_ids?.[0] ||
          r.distinct_id ||
          "Anonymous";
        return (
          <Row key={r.id}>
            <Text
              size="2"
              weight="medium"
              className="min-w-0 flex-1 truncate text-(--gray-12)"
              title={personLabel}
            >
              {personLabel}
            </Text>
            <Text
              size="1"
              className="w-64 shrink-0 truncate font-mono text-(--gray-11)"
              title={r.start_url ?? undefined}
            >
              {r.start_url ?? "—"}
            </Text>
            <Text size="1" className="w-24 shrink-0 text-(--gray-11)">
              {formatDuration(r.recording_duration)}
            </Text>
            <Text size="1" className="w-48 shrink-0 text-(--gray-10)">
              {formatDate(r.start_time)}
            </Text>
          </Row>
        );
      })}
    </Table>
  );
}

function PersonsTable({ query }: { query: string }) {
  const { data, isLoading, error } = usePersons(query);
  const rows = useMemo(() => {
    const all = data?.results ?? [];
    return [...all].sort(
      (a, b) =>
        timestampOrZero(b.last_seen_at) - timestampOrZero(a.last_seen_at),
    );
  }, [data]);

  return (
    <Table
      columns={[
        { label: "Person", className: "flex-1" },
        { label: "Distinct ID", className: "w-72 shrink-0" },
        { label: "Last seen", className: "w-48 shrink-0" },
      ]}
      isLoading={isLoading}
      error={error}
      emptyMessage={query ? `No persons matching "${query}".` : "No persons."}
      itemCount={rows.length}
    >
      {rows.map((p) => {
        const props = (p.properties as Record<string, unknown>) ?? {};
        const email =
          typeof props.email === "string" && props.email.length > 0
            ? props.email
            : null;
        return (
          <Row key={p.id}>
            <Flex direction="column" gap="1" className="min-w-0 flex-1">
              <Text
                size="2"
                weight="medium"
                className="truncate text-(--gray-12)"
              >
                {p.name || email || p.distinct_ids[0] || "Anonymous"}
              </Text>
              {email && (
                <Text size="1" className="truncate text-(--gray-11)">
                  {email}
                </Text>
              )}
            </Flex>
            <Text
              size="1"
              className="w-72 shrink-0 truncate font-mono text-(--gray-11)"
              title={p.distinct_ids.join(", ")}
            >
              {p.distinct_ids[0] ?? p.uuid}
            </Text>
            <Text size="1" className="w-48 shrink-0 text-(--gray-10)">
              {formatDate(p.last_seen_at)}
            </Text>
          </Row>
        );
      })}
    </Table>
  );
}
