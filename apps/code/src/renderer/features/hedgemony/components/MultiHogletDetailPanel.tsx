import type { Hoglet } from "@main/services/hedgemony/schemas";
import { X } from "@phosphor-icons/react";
import { Badge, IconButton, Text, Tooltip } from "@radix-ui/themes";
import { motion } from "framer-motion";
import { useMemo } from "react";
import { selectTaskSummary, useHogletStore } from "../stores/hogletStore";
import { STATUS_BADGE_COLOR, type TaskStatus } from "./hogletStatus";

interface MultiHogletDetailPanelProps {
  hogletIds: string[];
  onClose: () => void;
  /** Focus a single hoglet from the list (single-select). */
  onSelectOne: (hogletId: string) => void;
}

const STATUS_LABEL: Record<NonNullable<TaskStatus>, string> = {
  not_started: "Not started",
  queued: "Queued",
  in_progress: "In progress",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

// Display order for the status-count chips so the panel doesn't shuffle as
// statuses come and go.
const STATUS_ORDER: NonNullable<TaskStatus>[] = [
  "in_progress",
  "queued",
  "not_started",
  "completed",
  "failed",
  "cancelled",
];

export function MultiHogletDetailPanel({
  hogletIds,
  onClose,
  onSelectOne,
}: MultiHogletDetailPanelProps) {
  // Pull hoglets directly from the store so any updates (e.g. nest moves) keep
  // the panel rows in sync. Wrapped in useMemo so the array identity is stable
  // when ids/buckets don't change.
  const byBucket = useHogletStore((s) => s.byBucket);
  const summaries = useHogletStore((s) => s.taskSummaries);

  const hoglets = useMemo(() => {
    const idSet = new Set(hogletIds);
    const found: Hoglet[] = [];
    for (const bucket of Object.values(byBucket)) {
      for (const h of bucket) {
        if (idSet.has(h.id)) found.push(h);
      }
    }
    return found;
  }, [hogletIds, byBucket]);

  const statusCounts = useMemo(() => {
    const counts: Record<NonNullable<TaskStatus>, number> = {
      not_started: 0,
      queued: 0,
      in_progress: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    };
    for (const hoglet of hoglets) {
      const summary = summaries[hoglet.taskId];
      const status = (summary?.latest_run?.status ??
        "not_started") as NonNullable<TaskStatus>;
      counts[status] += 1;
    }
    return counts;
  }, [hoglets, summaries]);

  return (
    <motion.aside
      initial={{ y: "110%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "110%", opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 240, mass: 0.6 }}
      className="-translate-x-1/2 absolute bottom-3 left-1/2 z-10 flex max-h-[60vh] w-[min(720px,calc(100vw-1.5rem))] flex-col rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1) shadow-xl"
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenuCapture={(e) => e.stopPropagation()}
    >
      <header className="flex items-start justify-between gap-3 border-(--gray-5) border-b px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Text size="1" color="gray" weight="medium">
              Selection
            </Text>
            <Text size="3" weight="bold" className="text-(--gray-12)">
              {hogletIds.length} hoglets
            </Text>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_ORDER.map((status) => {
              const count = statusCounts[status];
              if (count === 0) return null;
              return (
                <Badge
                  key={status}
                  color={STATUS_BADGE_COLOR[status]}
                  size="1"
                  variant="soft"
                >
                  {count} {STATUS_LABEL[status].toLowerCase()}
                </Badge>
              );
            })}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Tooltip content="Close (Esc)" side="top">
            <IconButton
              size="1"
              variant="ghost"
              color="gray"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={15} />
            </IconButton>
          </Tooltip>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-2">
        {hoglets.length === 0 ? (
          <div className="px-2 py-4 text-center text-(--gray-10) text-[12px]">
            Selected hoglets are no longer on the map.
          </div>
        ) : (
          hoglets.map((hoglet) => (
            <MultiHogletRow
              key={hoglet.id}
              hoglet={hoglet}
              onSelect={() => onSelectOne(hoglet.id)}
            />
          ))
        )}
      </div>
    </motion.aside>
  );
}

interface MultiHogletRowProps {
  hoglet: Hoglet;
  onSelect: () => void;
}

function MultiHogletRow({ hoglet, onSelect }: MultiHogletRowProps) {
  const summary = useHogletStore(selectTaskSummary(hoglet.taskId));
  const status = (summary?.latest_run?.status ??
    "not_started") as NonNullable<TaskStatus>;
  const title = summary?.title ?? hoglet.taskId.slice(0, 8);
  const repo = summary?.repository ?? null;
  const origin = hoglet.nestId ? "Nested" : "Wild";

  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex items-center gap-3 rounded-(--radius-2) px-3 py-2 text-left transition-colors hover:bg-(--gray-3)"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Text size="2" weight="medium" className="truncate text-(--gray-12)">
          {title}
        </Text>
        <Text size="1" className="truncate text-(--gray-10)">
          {repo ?? "No repository"} · {origin}
        </Text>
      </div>
      <Badge color={STATUS_BADGE_COLOR[status]} size="1" variant="soft">
        {STATUS_LABEL[status]}
      </Badge>
    </button>
  );
}
