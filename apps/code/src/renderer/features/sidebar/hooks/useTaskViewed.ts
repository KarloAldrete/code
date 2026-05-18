import { trpcClient, useTRPC } from "@renderer/trpc";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";

interface TaskTimestamps {
  lastViewedAt: number | null;
  lastActivityAt: number | null;
  lastUserMessageAt: number | null;
}

type RawEntry = {
  pinnedAt: string | null;
  lastViewedAt: string | null;
  lastActivityAt: string | null;
  lastUserMessageAt: string | null;
};

type Raw = Record<string, RawEntry>;

const EMPTY_ENTRY: RawEntry = {
  pinnedAt: null,
  lastViewedAt: null,
  lastActivityAt: null,
  lastUserMessageAt: null,
};

function parseTimestamps(raw: Raw): Record<string, TaskTimestamps> {
  const result: Record<string, TaskTimestamps> = {};
  for (const [taskId, ts] of Object.entries(raw)) {
    result[taskId] = {
      lastViewedAt: ts.lastViewedAt
        ? new Date(ts.lastViewedAt).getTime()
        : null,
      lastActivityAt: ts.lastActivityAt
        ? new Date(ts.lastActivityAt).getTime()
        : null,
      lastUserMessageAt: ts.lastUserMessageAt
        ? new Date(ts.lastUserMessageAt).getTime()
        : null,
    };
  }
  return result;
}

function computeBumpedActivity(existing: RawEntry | undefined): string {
  const lastViewedMs = existing?.lastViewedAt
    ? new Date(existing.lastViewedAt).getTime()
    : 0;
  return new Date(Math.max(Date.now(), lastViewedMs + 1)).toISOString();
}

export function useTaskViewed() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.workspace.getAllTaskTimestamps.queryKey();

  const { data: rawTimestamps = {}, isLoading } = useQuery(
    trpc.workspace.getAllTaskTimestamps.queryOptions(undefined, {
      staleTime: 30_000,
    }),
  );

  const timestamps = useMemo(
    () => parseTimestamps(rawTimestamps),
    [rawTimestamps],
  );

  const optimisticOptions = (
    patcher: (existing: RawEntry | undefined) => Partial<RawEntry>,
  ) => ({
    onMutate: async ({ taskId }: { taskId: string }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Raw>(queryKey);
      const patch = patcher(previous?.[taskId]);
      queryClient.setQueryData<Raw>(queryKey, (old) => ({
        ...(old ?? {}),
        [taskId]: { ...EMPTY_ENTRY, ...old?.[taskId], ...patch },
      }));
      return { previous };
    },
    onError: (
      _err: unknown,
      _vars: unknown,
      ctx: { previous: Raw | undefined } | undefined,
    ) => {
      if (ctx?.previous) queryClient.setQueryData(queryKey, ctx.previous);
    },
  });

  const markViewedMutation = useMutation(
    trpc.workspace.markViewed.mutationOptions(
      optimisticOptions(() => ({ lastViewedAt: new Date().toISOString() })),
    ),
  );

  const markActivityMutation = useMutation(
    trpc.workspace.markActivity.mutationOptions(
      optimisticOptions((existing) => ({
        lastActivityAt: computeBumpedActivity(existing),
      })),
    ),
  );

  const markUserSendMutation = useMutation(
    trpc.workspace.markUserSend.mutationOptions(
      optimisticOptions((existing) => {
        const nowIso = new Date().toISOString();
        return {
          lastViewedAt: nowIso,
          lastActivityAt: computeBumpedActivity(existing),
          lastUserMessageAt: nowIso,
        };
      }),
    ),
  );

  return {
    timestamps,
    isLoading,
    markAsViewed: markViewedMutation.mutate,
    markActivity: markActivityMutation.mutate,
    markUserSend: markUserSendMutation.mutate,
  };
}

export const taskViewedApi = {
  async loadTimestamps(): Promise<Record<string, TaskTimestamps>> {
    const raw = await trpcClient.workspace.getAllTaskTimestamps.query();
    return parseTimestamps(raw);
  },

  markAsViewed(taskId: string): void {
    trpcClient.workspace.markViewed.mutate({ taskId });
  },

  markActivity(taskId: string): void {
    trpcClient.workspace.markActivity.mutate({ taskId });
  },
};
