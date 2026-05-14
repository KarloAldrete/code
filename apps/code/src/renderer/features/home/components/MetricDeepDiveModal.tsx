import { ArrowsClockwise, XIcon } from "@phosphor-icons/react";
import { Box, Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  METRIC_QUERIES,
  METRICS_META,
  type MetricKey,
  useMetric,
} from "../hooks/useHomeQueries";
import { Sparkline } from "./Sparkline";

interface MetricDeepDiveModalProps {
  metricKey: MetricKey | null;
  onClose: () => void;
}

export function MetricDeepDiveModal({
  metricKey,
  onClose,
}: MetricDeepDiveModalProps) {
  const open = metricKey !== null;
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Content maxWidth="640px">
        {metricKey && (
          <DeepDiveContent metricKey={metricKey} onClose={onClose} />
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}

function DeepDiveContent({
  metricKey,
  onClose,
}: {
  metricKey: MetricKey;
  onClose: () => void;
}) {
  const meta = METRICS_META[metricKey];
  const queryClient = useQueryClient();
  const { data, isLoading, error, isFetching } = useMetric(metricKey);

  const rows = useMemo(
    () =>
      (data?.results ?? []).map((r) => ({
        bucket: String(r[0]),
        value: Number(r[1]),
      })),
    [data],
  );
  const series = rows.map((r) => r.value);
  const last = series.length > 0 ? series[series.length - 1] : null;
  const prev = series.length > 1 ? series[series.length - 2] : null;
  const delta =
    last != null && prev != null && prev !== 0
      ? ((last - prev) / Math.abs(prev)) * 100
      : null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["home", "metric", metricKey] });
  };

  return (
    <>
      <Flex align="start" justify="between" mb="2">
        <Box>
          <Dialog.Title className="text-base">{meta.label}</Dialog.Title>
          <Text size="1" className="text-(--gray-11)">
            {meta.description}
          </Text>
        </Box>
        <Dialog.Close>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-(--gray-11) hover:bg-(--gray-3) hover:text-(--gray-12)"
            aria-label="Close"
          >
            <XIcon size={16} />
          </button>
        </Dialog.Close>
      </Flex>

      <Flex align="baseline" gap="3" mb="2">
        <Text size="7" weight="bold" className="font-mono text-(--gray-12)">
          {last != null ? fmtInt(last) : "—"}
        </Text>
        {delta != null && (
          <Text
            size="2"
            weight="medium"
            className={
              delta === 0
                ? "text-(--gray-11)"
                : delta > 0
                  ? "text-(--green-11)"
                  : "text-(--red-11)"
            }
          >
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}% vs prior week
          </Text>
        )}
      </Flex>

      <Box className="rounded-(--radius-3) border border-(--gray-5) bg-(--gray-2) p-3">
        {isLoading ? (
          <Text size="2" className="text-(--gray-11)">
            Running HogQL…
          </Text>
        ) : error ? (
          <Text size="2" className="text-(--red-11)">
            Query failed: {error.message}
          </Text>
        ) : (
          <Sparkline
            values={series}
            width={580}
            height={140}
            stroke={meta.color.stroke}
            fill={meta.color.fill}
          />
        )}
      </Box>

      <Box mt="3">
        <Text
          size="1"
          weight="medium"
          className="mb-1 block text-(--gray-11) uppercase tracking-wide"
        >
          Weekly buckets
        </Text>
        <Box className="max-h-48 overflow-y-auto rounded-(--radius-2) border border-(--gray-5)">
          <table className="w-full text-[12px]">
            <thead className="bg-(--gray-2)">
              <tr>
                <th className="border-(--gray-5) border-b px-3 py-1.5 text-left font-medium text-(--gray-11) uppercase tracking-wide">
                  Week of
                </th>
                <th className="border-(--gray-5) border-b px-3 py-1.5 text-right font-medium text-(--gray-11) uppercase tracking-wide">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {rows
                .slice()
                .reverse()
                .map((r) => (
                  <tr key={r.bucket} className="hover:bg-(--gray-2)">
                    <td className="border-(--gray-5) border-b px-3 py-1 font-mono text-(--gray-12)">
                      {String(r.bucket).slice(0, 10)}
                    </td>
                    <td className="border-(--gray-5) border-b px-3 py-1 text-right font-mono text-(--gray-12)">
                      {fmtInt(r.value)}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Box>
      </Box>

      <Box mt="3">
        <Text
          size="1"
          weight="medium"
          className="mb-1 block text-(--gray-11) uppercase tracking-wide"
        >
          Source HogQL
        </Text>
        <Box className="overflow-x-auto rounded-(--radius-2) border border-(--gray-5) bg-(--gray-12) p-3">
          <pre className="whitespace-pre-wrap font-mono text-(--gray-2) text-[11px]">
            {METRIC_QUERIES[metricKey]}
          </pre>
        </Box>
      </Box>

      <Flex justify="end" gap="2" mt="3">
        <Button
          variant="soft"
          color="gray"
          size="2"
          onClick={refresh}
          disabled={isFetching}
        >
          <ArrowsClockwise size={14} />
          {isFetching ? "Refreshing…" : "Re-run query"}
        </Button>
        <Button size="2" onClick={onClose}>
          Done
        </Button>
      </Flex>
    </>
  );
}

function fmtInt(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}
