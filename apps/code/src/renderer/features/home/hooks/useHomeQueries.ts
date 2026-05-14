import { useAuthenticatedQuery } from "@hooks/useAuthenticatedQuery";

/**
 * Each metric is a single HogQL query returning rows of [bucket_iso, value].
 * The dashboard renders the latest bucket as the headline number and the full
 * series as a sparkline. Deep-dive modals get the same `{columns, results}`
 * shape plus the source HogQL string.
 */

export interface HogQLResult {
  columns: string[];
  results: unknown[][];
}

const INTERNAL_EMAIL_FILTER =
  "(person.properties['email'] IS NULL OR person.properties['email'] NOT ILIKE '%@posthog.com%')";

export const METRIC_QUERIES = {
  weeklyActiveUsers: `
    SELECT toStartOfWeek(timestamp) AS bucket,
           uniq(person_id) AS value
    FROM events
    WHERE event = '$pageview'
      AND timestamp >= now() - INTERVAL 84 DAY
      AND ${INTERNAL_EMAIL_FILTER}
    GROUP BY bucket
    ORDER BY bucket ASC
  `.trim(),

  weeklySignups: `
    SELECT toStartOfWeek(timestamp) AS bucket,
           count() AS value
    FROM events
    WHERE event = 'user signed up'
      AND timestamp >= now() - INTERVAL 84 DAY
      AND ${INTERNAL_EMAIL_FILTER}
    GROUP BY bucket
    ORDER BY bucket ASC
  `.trim(),

  weeklyInsightsCreated: `
    SELECT toStartOfWeek(timestamp) AS bucket,
           count() AS value
    FROM events
    WHERE event IN ('insight created', 'insight saved')
      AND timestamp >= now() - INTERVAL 84 DAY
      AND ${INTERNAL_EMAIL_FILTER}
    GROUP BY bucket
    ORDER BY bucket ASC
  `.trim(),

  weeklyExperimentsLaunched: `
    SELECT toStartOfWeek(timestamp) AS bucket,
           count() AS value
    FROM events
    WHERE event = 'experiment launched'
      AND timestamp >= now() - INTERVAL 84 DAY
      AND ${INTERNAL_EMAIL_FILTER}
    GROUP BY bucket
    ORDER BY bucket ASC
  `.trim(),

  weeklyMcpToolCalls: `
    SELECT toStartOfWeek(timestamp) AS bucket,
           count() AS value
    FROM events
    WHERE event IN ('mcp tool call', 'mcp_tool_call')
      AND timestamp >= now() - INTERVAL 84 DAY
      AND ${INTERNAL_EMAIL_FILTER}
    GROUP BY bucket
    ORDER BY bucket ASC
  `.trim(),
} as const;

export type MetricKey = keyof typeof METRIC_QUERIES;

export interface MetricMeta {
  key: MetricKey;
  label: string;
  unit: "int";
  color: { stroke: string; fill: string };
  description: string;
}

export const METRICS_META: Record<MetricKey, MetricMeta> = {
  weeklyActiveUsers: {
    key: "weeklyActiveUsers",
    label: "Weekly active users",
    unit: "int",
    color: { stroke: "var(--blue-9)", fill: "var(--blue-4)" },
    description: "Unique persons firing a pageview each week (last 12 weeks).",
  },
  weeklySignups: {
    key: "weeklySignups",
    label: "Weekly signups",
    unit: "int",
    color: { stroke: "var(--green-9)", fill: "var(--green-4)" },
    description: "New user signups per week (last 12 weeks).",
  },
  weeklyInsightsCreated: {
    key: "weeklyInsightsCreated",
    label: "Insights created",
    unit: "int",
    color: { stroke: "var(--iris-9)", fill: "var(--iris-4)" },
    description: "Insights created or saved per week (last 12 weeks).",
  },
  weeklyExperimentsLaunched: {
    key: "weeklyExperimentsLaunched",
    label: "Experiments launched",
    unit: "int",
    color: { stroke: "var(--purple-9)", fill: "var(--purple-4)" },
    description: "Experiments launched per week (last 12 weeks).",
  },
  weeklyMcpToolCalls: {
    key: "weeklyMcpToolCalls",
    label: "MCP tool calls",
    unit: "int",
    color: { stroke: "var(--amber-9)", fill: "var(--amber-4)" },
    description: "MCP tool invocations per week (last 12 weeks).",
  },
};

export function useMetric(key: MetricKey) {
  const sql = METRIC_QUERIES[key];
  return useAuthenticatedQuery<HogQLResult>(
    ["home", "metric", key],
    (client) => client.query(sql),
    { staleTime: 60_000 },
  );
}

const TOP_GROUPS_QUERY = `
  SELECT \`$group_0\` AS group_key,
         count() AS event_count
  FROM events
  WHERE \`$group_0\` != ''
    AND timestamp >= now() - INTERVAL 30 DAY
    AND ${INTERNAL_EMAIL_FILTER}
  GROUP BY group_key
  ORDER BY event_count DESC
  LIMIT 10
`.trim();

export function useTopGroups() {
  return useAuthenticatedQuery<HogQLResult>(
    ["home", "top-groups"],
    (client) => client.query(TOP_GROUPS_QUERY),
    { staleTime: 60_000 },
  );
}

export const TOP_GROUPS_HOGQL = TOP_GROUPS_QUERY;
