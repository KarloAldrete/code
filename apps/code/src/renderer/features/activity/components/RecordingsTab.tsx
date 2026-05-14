import { Eye, EyeSlash } from "@phosphor-icons/react";
import { Flex, Text } from "@radix-ui/themes";
import { useMemo } from "react";
import { useRecordingsList } from "../hooks/useActivityData";
import { ActivityListShell } from "./ActivityListShell";

interface RecordingsTabProps {
  search: string;
}

export function RecordingsTab({ search }: RecordingsTabProps) {
  const { data, isLoading, error } = useRecordingsList();

  const filtered = useMemo(() => {
    const all = data?.results ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => {
      const distinct = r.distinct_id?.toLowerCase() ?? "";
      const url = r.start_url?.toLowerCase() ?? "";
      const id = r.id.toLowerCase();
      return distinct.includes(q) || url.includes(q) || id.includes(q);
    });
  }, [data, search]);

  return (
    <ActivityListShell
      isLoading={isLoading}
      error={error}
      emptyMessage={
        search
          ? `No recordings matching "${search}".`
          : "No session recordings captured yet."
      }
      itemCount={filtered.length}
    >
      <Flex direction="column" className="divide-y divide-(--gray-5)">
        {filtered.map((r) => (
          <Flex
            key={r.id}
            direction="column"
            gap="1"
            px="5"
            py="3"
            className="hover:bg-(--gray-2)"
          >
            <Flex align="center" justify="between" gap="3">
              <Flex align="center" gap="2" className="min-w-0">
                {r.viewed ? (
                  <EyeSlash size={14} className="text-(--gray-10)" />
                ) : (
                  <Eye size={14} className="text-(--accent-11)" />
                )}
                <Text size="2" weight="medium" className="text-(--gray-12)">
                  {r.start_url ?? "(no entry url)"}
                </Text>
              </Flex>
              <Text size="1" className="shrink-0 text-(--gray-10)">
                {formatTimestamp(r.start_time)}
              </Text>
            </Flex>
            <Flex align="center" gap="2" wrap="wrap">
              <Chip>{formatDuration(r.recording_duration)}</Chip>
              <Chip>{r.click_count ?? 0} clicks</Chip>
              <Chip>{r.keypress_count ?? 0} keystrokes</Chip>
              {(r.console_error_count ?? 0) > 0 && (
                <Chip color="red">{r.console_error_count} errors</Chip>
              )}
              <Chip
                color="gray"
                title={r.distinct_id ?? undefined}
                className="font-mono"
              >
                {r.distinct_id ?? "anonymous"}
              </Chip>
            </Flex>
          </Flex>
        ))}
      </Flex>
    </ActivityListShell>
  );
}

interface ChipProps {
  children: React.ReactNode;
  color?: "gray" | "red";
  title?: string;
  className?: string;
}

function Chip({ children, color = "gray", title, className = "" }: ChipProps) {
  const colorClass =
    color === "red"
      ? "bg-(--red-3) text-(--red-11)"
      : "bg-(--gray-3) text-(--gray-11)";
  return (
    <Text
      size="1"
      title={title}
      className={`rounded-(--radius-1) px-1.5 py-0.5 ${colorClass} ${className}`}
    >
      {children}
    </Text>
  );
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const s = Math.floor(seconds);
  const m = Math.floor(s / 60);
  const remaining = s % 60;
  if (m === 0) return `${remaining}s`;
  return `${m}m ${remaining}s`;
}
