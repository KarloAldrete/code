import { User } from "@phosphor-icons/react";
import { Flex, Text } from "@radix-ui/themes";
import { usePersonsList } from "../hooks/useActivityData";
import { ActivityListShell } from "./ActivityListShell";

interface PersonsTabProps {
  search: string;
}

export function PersonsTab({ search }: PersonsTabProps) {
  const { data, isLoading, error } = usePersonsList({ search });
  const persons = data?.results ?? [];

  return (
    <ActivityListShell
      isLoading={isLoading}
      error={error}
      emptyMessage={
        search ? `No persons matching "${search}".` : "No persons captured yet."
      }
      itemCount={persons.length}
    >
      <Flex direction="column" className="divide-y divide-(--gray-5)">
        {persons.map((p) => {
          const props = (p.properties as Record<string, unknown>) ?? {};
          const email = stringValue(props.email);
          return (
            <Flex
              key={p.id}
              gap="3"
              align="center"
              px="5"
              py="3"
              className="hover:bg-(--gray-2)"
            >
              <Flex
                align="center"
                justify="center"
                className="h-8 w-8 shrink-0 rounded-full bg-(--gray-3) text-(--gray-11)"
              >
                <User size={14} />
              </Flex>
              <Flex direction="column" gap="1" className="min-w-0 flex-1">
                <Text size="2" weight="medium" className="text-(--gray-12)">
                  {p.name || email || p.distinct_ids[0] || "Anonymous person"}
                </Text>
                <Flex gap="2" align="center" wrap="wrap">
                  {email && (
                    <Text
                      size="1"
                      className="rounded-(--radius-1) bg-(--gray-3) px-1.5 py-0.5 text-(--gray-11)"
                    >
                      {email}
                    </Text>
                  )}
                  <Text
                    size="1"
                    className="font-mono text-(--gray-10)"
                    title={p.distinct_ids.join(", ")}
                  >
                    {p.distinct_ids[0] ?? p.uuid}
                  </Text>
                </Flex>
              </Flex>
              <Text size="1" className="shrink-0 text-(--gray-10)">
                {p.last_seen_at
                  ? `Seen ${formatTimestamp(p.last_seen_at)}`
                  : "Never seen"}
              </Text>
            </Flex>
          );
        })}
      </Flex>
    </ActivityListShell>
  );
}

function stringValue(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}
