import { Box, Flex, Text } from "@radix-ui/themes";
import { useEventsList } from "../hooks/useActivityData";
import { ActivityListShell } from "./ActivityListShell";

interface EventsTabProps {
  eventFilter: string;
}

export function EventsTab({ eventFilter }: EventsTabProps) {
  const { data, isLoading, error } = useEventsList({ event: eventFilter });
  const events = data?.results ?? [];

  return (
    <ActivityListShell
      isLoading={isLoading}
      error={error}
      emptyMessage={
        eventFilter
          ? `No events matching "${eventFilter}".`
          : "No events captured yet."
      }
      itemCount={events.length}
    >
      <Flex direction="column" className="divide-y divide-(--gray-5)">
        {events.map((event) => (
          <Flex
            key={event.id}
            direction="column"
            gap="1"
            px="5"
            py="3"
            className="hover:bg-(--gray-2)"
          >
            <Flex align="center" justify="between" gap="3">
              <Flex align="center" gap="2" className="min-w-0">
                <Text
                  size="2"
                  weight="medium"
                  className="font-mono text-(--gray-12)"
                >
                  {event.event}
                </Text>
                <Text
                  size="1"
                  className="rounded-(--radius-1) bg-(--gray-3) px-1.5 py-0.5 font-mono text-(--gray-11)"
                  title={event.distinct_id}
                >
                  {truncate(event.distinct_id, 32)}
                </Text>
              </Flex>
              <Text size="1" className="shrink-0 text-(--gray-10)">
                {formatTimestamp(event.timestamp)}
              </Text>
            </Flex>
            <PropertiesPreview properties={event.properties} />
          </Flex>
        ))}
      </Flex>
    </ActivityListShell>
  );
}

function PropertiesPreview({
  properties,
}: {
  properties: Record<string, unknown>;
}) {
  const entries = Object.entries(properties)
    .filter(([key]) => !key.startsWith("$"))
    .slice(0, 4);
  if (entries.length === 0) return null;

  return (
    <Box className="overflow-x-auto">
      <Flex gap="2" className="w-max">
        {entries.map(([key, value]) => (
          <Text
            key={key}
            size="1"
            className="rounded-(--radius-1) bg-(--gray-2) px-1.5 py-0.5 font-mono text-(--gray-11)"
          >
            {key}: {formatValue(value)}
          </Text>
        ))}
      </Flex>
    </Box>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return truncate(v, 40);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return truncate(JSON.stringify(v), 40);
}

function truncate(s: string, n: number) {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
