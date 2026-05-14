import { useTasks } from "@features/tasks/hooks/useTasks";
import { useMeQuery } from "@hooks/useMeQuery";
import type { Task } from "@shared/types";
import { logger } from "@utils/logger";
import { useEffect, useMemo } from "react";
import { useWorkThreadsStore } from "../stores/workThreadsStore";

const log = logger.scope("work-thread-tasks");

/**
 * HACKATHON SHORTCUT — Work-mode thread list.
 *
 * A task is shown in the Work sidebar's Threads section when ANY of:
 *   1. It's in the local `workThreadsStore` — set when the current user
 *      creates a task from `WorkHomePrompt` / `WorkSampleProjects`.
 *      Reliable and instant; doesn't depend on backend marker storage.
 *   2. The current user's uuid is in
 *      `task.json_schema.__code_meta.collaborators` — populated server-side
 *      when someone `@`-mentions and PATCHes the task. This is how shared
 *      threads reach the recipient. We use `json_schema` because the API
 *      Task serializer exposes it; the earlier squat on `repository_config`
 *      didn't round-trip.
 *
 * When the real backend lands (Task.collaborators M2M + endpoint), swap (2)
 * for `task.collaborators.includes(me)` and drop the local store entirely.
 */
function readCollaborators(task: Task): string[] {
  const schema = task.json_schema as
    | { __code_meta?: { collaborators?: unknown } | null }
    | null
    | undefined;
  const collabs = schema?.__code_meta?.collaborators;
  return Array.isArray(collabs)
    ? collabs.filter((v): v is string => typeof v === "string")
    : [];
}

export function useWorkThreadTasks() {
  const { data: currentUser } = useMeQuery();
  const query = useTasks({ showAllUsers: true });
  const localThreadIds = useWorkThreadsStore((s) => s.taskIds);

  const sorted = useMemo<Task[]>(() => {
    const tasks = query.data ?? [];
    const myIdentifiers = new Set(
      [currentUser?.uuid, currentUser?.email].filter(
        (v): v is string => typeof v === "string" && v.length > 0,
      ),
    );
    const localIdSet = new Set(localThreadIds);
    return tasks
      .filter((t) => {
        if (localIdSet.has(t.id)) return true;
        return readCollaborators(t).some((c) => myIdentifiers.has(c));
      })
      .sort((a, b) => {
        const ta = new Date(a.created_at).getTime();
        const tb = new Date(b.created_at).getTime();
        return tb - ta;
      });
  }, [query.data, currentUser?.uuid, currentUser?.email, localThreadIds]);

  // TEMP HACKATHON DEBUG — paste this log to diagnose why a shared task isn't
  // showing up. Look for any task whose collaborators contain your uuid/email.
  useEffect(() => {
    if (!query.data) return;
    const me = {
      uuid: currentUser?.uuid,
      email: currentUser?.email,
    };
    const tasksWithCollabs = query.data
      .map((t) => ({ task: t, collaborators: readCollaborators(t) }))
      .filter(({ collaborators }) => collaborators.length > 0)
      .map(({ task: t, collaborators }) => ({
        id: t.id,
        title: t.title,
        created_by_email: t.created_by?.email,
        collaborators,
      }));
    log.info("useWorkThreadTasks debug", {
      me,
      totalTasks: query.data.length,
      tasksWithAnyCollaborators: tasksWithCollabs.length,
      matchedThreads: sorted.length,
      sampleTasksWithCollabs: tasksWithCollabs.slice(0, 10),
    });
  }, [query.data, sorted.length, currentUser?.uuid, currentUser?.email]);

  return { ...query, data: sorted };
}
