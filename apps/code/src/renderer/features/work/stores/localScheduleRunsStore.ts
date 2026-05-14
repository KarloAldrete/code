import type { Schemas } from "@renderer/api/generated";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LocalScheduleRunStatus = "running" | "failed";

export interface LocalScheduleRun {
  lastRunAt: string;
  status: LocalScheduleRunStatus;
  taskId?: string;
  error?: string;
}

interface LocalScheduleRunsState {
  runs: Record<string, LocalScheduleRun>;
}

interface LocalScheduleRunsActions {
  recordRun: (scheduleId: string, run: LocalScheduleRun) => void;
  clearRun: (scheduleId: string) => void;
}

type LocalScheduleRunsStore = LocalScheduleRunsState & LocalScheduleRunsActions;

export const useLocalScheduleRunsStore = create<LocalScheduleRunsStore>()(
  persist(
    (set) => ({
      runs: {},
      recordRun: (scheduleId, run) =>
        set((state) => ({ runs: { ...state.runs, [scheduleId]: run } })),
      clearRun: (scheduleId) =>
        set((state) => {
          if (!(scheduleId in state.runs)) return state;
          const next = { ...state.runs };
          delete next[scheduleId];
          return { runs: next };
        }),
    }),
    {
      name: "local-schedule-runs",
      partialize: (state) => ({ runs: state.runs }),
    },
  ),
);

export interface ScheduleDisplayInfo {
  lastRunAt: string | null;
  status: string | null;
  error: string | null;
  taskId: string | null;
}

/**
 * Merge the server-managed `last_run_*` fields on a TaskAutomation with any
 * locally-recorded run. The server's TaskAutomation serializer treats the
 * `last_run_*` fields as read-only (only the cron worker writes them), so a
 * client-side PATCH won't move them. We layer our own local run state on top
 * so the badge reflects "Running" / "Last ran just now" right after a local
 * fire instead of the stale cloud-cron failure.
 *
 * Local state wins when its timestamp is at least as recent as the server's;
 * otherwise the server's value is used (e.g. after the user wipes app state).
 */
export function getScheduleDisplayInfo(
  automation: Schemas.TaskAutomation,
  localRun: LocalScheduleRun | undefined,
): ScheduleDisplayInfo {
  if (
    localRun &&
    (!automation.last_run_at ||
      new Date(localRun.lastRunAt).getTime() >=
        new Date(automation.last_run_at).getTime())
  ) {
    return {
      lastRunAt: localRun.lastRunAt,
      status: localRun.status,
      error: localRun.error ?? null,
      taskId: localRun.taskId ?? null,
    };
  }
  return {
    lastRunAt: automation.last_run_at,
    status: automation.last_run_status,
    error: automation.last_error,
    taskId: automation.last_task_id,
  };
}

export function useScheduleDisplayInfo(
  automation: Schemas.TaskAutomation | null,
): ScheduleDisplayInfo {
  const localRun = useLocalScheduleRunsStore((s) =>
    automation ? s.runs[automation.id] : undefined,
  );
  if (!automation) {
    return { lastRunAt: null, status: null, error: null, taskId: null };
  }
  return getScheduleDisplayInfo(automation, localRun);
}
