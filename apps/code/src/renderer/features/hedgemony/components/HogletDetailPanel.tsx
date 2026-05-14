import { CommandCenterSessionView } from "@features/command-center/components/CommandCenterSessionView";
import { useAuthenticatedQuery } from "@hooks/useAuthenticatedQuery";
import type { Hoglet } from "@main/services/hedgemony/schemas";
import {
  ArrowSquareOut,
  CaretDown,
  ChatCircle,
  House,
  X,
} from "@phosphor-icons/react";
import { Badge, IconButton, Text, Tooltip } from "@radix-ui/themes";
import type { Task } from "@shared/types";
import { useNavigationStore } from "@stores/navigationStore";
import { motion } from "framer-motion";
import { useState } from "react";
import { useHogletPositionStore } from "../stores/hogletPositionStore";
import { selectTaskSummary, useHogletStore } from "../stores/hogletStore";
import { STATUS_BADGE_COLOR, type TaskStatus } from "./hogletStatus";

interface HogletDetailPanelProps {
  hoglet: Hoglet;
  onClose: () => void;
}

const STATUS_LABEL: Record<NonNullable<TaskStatus>, string> = {
  not_started: "Not started",
  queued: "Queued",
  in_progress: "In progress",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export function HogletDetailPanel({ hoglet, onClose }: HogletDetailPanelProps) {
  const summary = useHogletStore(selectTaskSummary(hoglet.taskId));
  const navigateToTask = useNavigationStore((s) => s.navigateToTask);
  const clearPosition = useHogletPositionStore((s) => s.clearPosition);
  const hasOverride = useHogletPositionStore(
    (s) => s.positions[hoglet.id] !== undefined,
  );

  const [chatOpen, setChatOpen] = useState(false);

  // Always fetch the task so the summary can show the original prompt; the
  // session itself only spins up once the user expands into chat mode below.
  const taskQuery = useAuthenticatedQuery<Task>(
    ["tasks", "detail", hoglet.taskId],
    (client) => client.getTask(hoglet.taskId) as unknown as Promise<Task>,
    { staleTime: 30_000 },
  );

  const status: NonNullable<TaskStatus> = (summary?.latest_run?.status ??
    "not_started") as NonNullable<TaskStatus>;
  const title = summary?.title ?? hoglet.taskId.slice(0, 8);
  const origin = hoglet.nestId ? "Nested" : "Wild";
  const provenance = hoglet.signalReportId
    ? "Signal-backed"
    : "Operator-spawned";
  const createdAt = summary?.created_at ?? hoglet.createdAt;
  const updatedAt = summary?.updated_at ?? hoglet.updatedAt;

  const handleOpenInEditor = () => {
    if (taskQuery.data) navigateToTask(taskQuery.data);
  };

  const description = taskQuery.data?.description?.trim() ?? "";

  return (
    <motion.aside
      key={hoglet.id}
      initial={{ y: "110%", opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: "110%", opacity: 0 }}
      transition={{ type: "spring", damping: 28, stiffness: 240, mass: 0.6 }}
      className="-translate-x-1/2 absolute bottom-3 left-1/2 z-10 flex w-[min(720px,calc(100vw-1.5rem))] flex-col rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1) shadow-xl"
      style={{ height: chatOpen ? "min(60vh, 540px)" : "auto" }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenuCapture={(e) => e.stopPropagation()}
    >
      <header className="flex items-start justify-between gap-3 border-(--gray-5) border-b px-4 py-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <Text size="1" color="gray" weight="medium">
              Hoglet
            </Text>
            <Badge color={STATUS_BADGE_COLOR[status]} size="1" variant="soft">
              {STATUS_LABEL[status]}
            </Badge>
            <Badge color="gray" size="1" variant="surface">
              {origin}
            </Badge>
            <Badge color="gray" size="1" variant="surface">
              {provenance}
            </Badge>
          </div>
          <Text size="3" weight="bold" className="truncate text-(--gray-12)">
            {title}
          </Text>
          <Text size="1" className="text-(--gray-10)">
            {summary?.repository ?? "No repository"} · updated{" "}
            {new Date(updatedAt).toLocaleString()}
          </Text>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {hasOverride && (
            <Tooltip content="Return hoglet to its default spot" side="top">
              <IconButton
                size="1"
                variant="soft"
                color="gray"
                onClick={() => clearPosition(hoglet.id)}
                aria-label="Send to default position"
              >
                <House size={14} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip content="Open task in editor" side="top">
            <IconButton
              size="1"
              variant="soft"
              color="gray"
              onClick={handleOpenInEditor}
              aria-label="Open task in editor"
            >
              <ArrowSquareOut size={14} />
            </IconButton>
          </Tooltip>
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

      {chatOpen ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2 border-(--gray-5) border-b bg-(--gray-2) px-3 py-1.5">
            <Text size="1" color="gray" weight="medium">
              Conversation
            </Text>
            <button
              type="button"
              onClick={() => setChatOpen(false)}
              className="flex items-center gap-1 rounded-(--radius-2) px-2 py-0.5 text-(--gray-11) text-[11px] hover:bg-(--gray-3) hover:text-(--gray-12)"
            >
              <CaretDown size={12} />
              Collapse
            </button>
          </div>
          <div className="min-h-0 flex-1">
            {taskQuery.data ? (
              <CommandCenterSessionView
                taskId={hoglet.taskId}
                task={taskQuery.data}
                isActiveSession
              />
            ) : (
              <div className="flex h-full items-center justify-center text-(--gray-10) text-[12px]">
                {taskQuery.isError
                  ? "Could not load task"
                  : "Loading conversation…"}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => setChatOpen(true)}
            className="group flex flex-col gap-1.5 rounded-(--radius-2) border border-(--gray-5) bg-(--gray-2) p-3 text-left transition-colors hover:border-(--accent-7) hover:bg-(--accent-3)"
          >
            <div className="flex items-center justify-between gap-2">
              <Text
                size="1"
                weight="medium"
                className="text-(--gray-10) uppercase tracking-wide group-hover:text-(--accent-11)"
              >
                Conversation summary
              </Text>
              <span className="flex items-center gap-1 text-(--gray-10) text-[11px] group-hover:text-(--accent-11)">
                <ChatCircle size={12} />
                Open chat
              </span>
            </div>
            {taskQuery.isLoading && !description ? (
              <Text size="2" className="text-(--gray-10)">
                Loading task details…
              </Text>
            ) : description ? (
              <Text
                size="2"
                className="line-clamp-3 whitespace-pre-wrap text-(--gray-12)"
              >
                {description}
              </Text>
            ) : (
              <Text size="2" className="text-(--gray-10)">
                {taskQuery.isError
                  ? "Could not load task description."
                  : "No description recorded for this task."}
              </Text>
            )}
          </button>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-(--gray-10) text-[11px]">
            <span className="font-mono">{hoglet.taskId.slice(0, 12)}</span>
            <span>
              Created {new Date(createdAt).toLocaleDateString()} ·{" "}
              {new Date(createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {hoglet.affinityScore !== null && (
              <span>Affinity {hoglet.affinityScore.toFixed(2)}</span>
            )}
          </div>
        </div>
      )}
    </motion.aside>
  );
}
