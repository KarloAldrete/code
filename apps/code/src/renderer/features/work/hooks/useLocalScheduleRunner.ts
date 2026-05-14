import { useFolders } from "@features/folders/hooks/useFolders";
import { useSettingsStore } from "@features/settings/stores/settingsStore";
import type { Schemas } from "@renderer/api/generated";
import { get } from "@renderer/di/container";
import { RENDERER_TOKENS } from "@renderer/di/tokens";
import type {
  TaskCreationInput,
  TaskService,
} from "@renderer/features/task-detail/service/service";
import { trpcClient } from "@renderer/trpc/client";
import { useNavigationStore } from "@stores/navigationStore";
import { logger } from "@utils/logger";
import { useCallback, useEffect, useRef } from "react";
import { useWorkThreadsStore } from "../stores/workThreadsStore";
import { nextRunForPreset, presetForCron } from "../utils/schedulePresets";
import { decodePrompt } from "../utils/sourcesPrompt";
import { useScheduledTasks, useUpdateScheduledTask } from "./useScheduledTasks";

// Scheduled tasks default to a lighter model per adapter, since they're
// long-running cron jobs where the heavier flagship models add cost/latency
// without much quality gain for typical scheduled prompts. Users can override
// later via a per-schedule model picker once we ship one.
const DEFAULT_MODEL_BY_ADAPTER: Record<"claude" | "codex", string> = {
  claude: "claude-sonnet-4-6",
  codex: "gpt-5.4",
};

const log = logger.scope("local-schedule-runner");

interface ScheduledTimer {
  timeoutId: ReturnType<typeof setTimeout>;
  scheduledFor: number;
}

function computeNextFire(
  automation: Schemas.TaskAutomation,
  now: Date = new Date(),
): Date | null {
  // The schedule editor only allows the preset crons defined in
  // schedulePresets.ts. Any automation with a non-preset cron predates the
  // local runner or was edited externally — skip it rather than running an
  // unrecognised schedule.
  const preset = presetForCron(automation.cron_expression);
  if (!preset) {
    log.warn("Skipping schedule with non-preset cron", {
      id: automation.id,
      cron: automation.cron_expression,
    });
    return null;
  }
  return nextRunForPreset(preset.id, now);
}

async function resolveRepoPath(folderPaths: string[]): Promise<string> {
  if (folderPaths.length > 0) return folderPaths[0];
  return trpcClient.os.getHomeDir.query();
}

export interface FireOptions {
  /** Navigate to the task once it's created. False for cron fires; true for "Run now". */
  navigate: boolean;
}

export type FireFn = (
  automation: Schemas.TaskAutomation,
  opts: FireOptions,
) => Promise<{ taskId: string } | null>;

/**
 * Build the function that fires a scheduled task through the regular local-task
 * path (TaskService.createTask), then optimistically updates the automation's
 * `last_run_*` fields so the schedules UI reflects the local run.
 */
export function useFireScheduledTask(): FireFn {
  const { folders, isLoaded: foldersLoaded } = useFolders();
  const addThread = useWorkThreadsStore((s) => s.addThread);
  const navigateToWorkTask = useNavigationStore((s) => s.navigateToWorkTask);
  const updateScheduledTask = useUpdateScheduledTask();
  const adapter = useSettingsStore((s) => s.lastUsedAdapter ?? "claude");

  return useCallback(
    async (automation, opts) => {
      if (!foldersLoaded) {
        log.warn("Folders not loaded; skipping scheduled fire", {
          id: automation.id,
        });
        return null;
      }

      const folderPaths = folders.map((f) => f.path);
      const repoPath = await resolveRepoPath(folderPaths);
      const { body } = decodePrompt(automation.prompt);

      const input: TaskCreationInput = {
        content: body,
        repoPath,
        workspaceMode: "local",
        adapter,
        model: DEFAULT_MODEL_BY_ADAPTER[adapter],
      };

      const firedAt = new Date().toISOString();
      const taskService = get<TaskService>(RENDERER_TOKENS.TaskService);

      const result = await taskService.createTask(input, (output) => {
        addThread(output.task.id);
        if (opts.navigate) navigateToWorkTask(output.task.id);
      });

      if (!result.success) {
        log.error("Scheduled fire failed", {
          id: automation.id,
          error: result.error,
          failedStep: result.failedStep,
        });
        try {
          await updateScheduledTask.mutateAsync({
            id: automation.id,
            updates: {
              last_run_at: firedAt,
              last_run_status: "failed",
              last_error: result.error ?? "Unknown error",
            },
          });
        } catch (e) {
          log.error("Failed to update automation status (failure path)", {
            id: automation.id,
            error: e,
          });
        }
        return null;
      }

      try {
        await updateScheduledTask.mutateAsync({
          id: automation.id,
          updates: {
            last_run_at: firedAt,
            last_run_status: "in_progress",
            last_task_id: result.data.task.id,
            last_error: null,
          },
        });
      } catch (e) {
        log.error("Failed to update automation status (success path)", {
          id: automation.id,
          error: e,
        });
      }

      return { taskId: result.data.task.id };
    },
    [
      folders,
      foldersLoaded,
      addThread,
      navigateToWorkTask,
      updateScheduledTask,
      adapter,
    ],
  );
}

/**
 * Renderer-side cron firer for scheduled tasks. Runs each schedule's prompt
 * through the same code path as a user-typed prompt in Work mode, so the UX is
 * identical (sidebar entry, live local agent, notifications, etc.).
 *
 * Behavior:
 *  - Reads schedules from the TanStack Query cache populated by
 *    `useScheduledTasks` (already polls every 30s).
 *  - For each enabled schedule, sets a `setTimeout` to fire at the next cron
 *    tick. Re-syncs whenever the schedules list changes (create, delete,
 *    enabled toggle, cron edit).
 *  - Missed runs while the app was closed are skipped silently — timers only
 *    arm for future ticks after mount.
 *  - In-memory `firedKeys` set prevents same-tick double-fire within a session.
 *  - Multi-device: each desktop fires its own timer. Duplicate runs are
 *    accepted (a deliberate product decision).
 */
export function useLocalScheduleRunner(): void {
  const { data: automations } = useScheduledTasks();
  const fire = useFireScheduledTask();

  // Hold the latest fire fn in a ref so the timer-scheduling effect doesn't
  // re-run every time `fire`'s identity changes (it captures mutation state).
  const fireRef = useRef(fire);
  useEffect(() => {
    fireRef.current = fire;
  }, [fire]);

  const timersRef = useRef(new Map<string, ScheduledTimer>());
  const firedKeysRef = useRef(new Set<string>());

  useEffect(() => {
    if (!automations) return;

    const timers = timersRef.current;
    const liveById = new Map<string, Schemas.TaskAutomation>();
    for (const a of automations) {
      if (a.enabled !== false) liveById.set(a.id, a);
    }

    // Cancel timers for schedules that have been deleted or disabled.
    for (const [id, timer] of timers) {
      if (!liveById.has(id)) {
        clearTimeout(timer.timeoutId);
        timers.delete(id);
      }
    }

    // Arm a timer for each enabled schedule's next fire time.
    for (const automation of liveById.values()) {
      const next = computeNextFire(automation);
      if (!next) continue;

      const ms = next.getTime() - Date.now();
      if (ms <= 0) continue; // Skip silently — don't backfill past ticks.

      const existing = timers.get(automation.id);
      if (existing && existing.scheduledFor === next.getTime()) continue;
      if (existing) clearTimeout(existing.timeoutId);

      const fireKey = `${automation.id}@${next.toISOString()}`;
      const timeoutId = setTimeout(() => {
        if (firedKeysRef.current.has(fireKey)) return;
        firedKeysRef.current.add(fireKey);
        timersRef.current.delete(automation.id);
        log.info("Firing scheduled task locally", {
          id: automation.id,
          name: automation.name,
        });
        void fireRef.current(automation, { navigate: false }).catch((e) =>
          log.error("Failed to fire scheduled task", {
            id: automation.id,
            error: e,
          }),
        );
      }, ms);

      timers.set(automation.id, { timeoutId, scheduledFor: next.getTime() });
    }
  }, [automations]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timer of timers.values()) clearTimeout(timer.timeoutId);
      timers.clear();
    };
  }, []);
}
