import { trpcClient, useTRPC } from "@renderer/trpc";
import type {
  NewTileInput,
  TileSize,
  WorkProject,
} from "@shared/types/work-projects";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useCallback } from "react";

export function useWorkProjects() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const query = useQuery(trpc.workProjects.list.queryOptions());

  useSubscription(
    trpc.workProjects.onProjectsChanged.subscriptionOptions(undefined, {
      onData: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.workProjects.list.queryKey(),
        });
      },
    }),
  );

  return query;
}

export function useProjectCanvas(projectId: string | undefined) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const query = useQuery({
    ...trpc.workProjects.get.queryOptions({ projectId: projectId ?? "" }),
    enabled: !!projectId,
  });

  useSubscription(
    trpc.workProjects.onProjectChanged.subscriptionOptions(
      { projectId: projectId ?? "" },
      {
        enabled: !!projectId,
        onData: () => {
          if (!projectId) return;
          queryClient.invalidateQueries({
            queryKey: trpc.workProjects.get.queryKey({ projectId }),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.workProjects.list.queryKey(),
          });
        },
      },
    ),
  );

  const invalidate = useCallback(() => {
    if (!projectId) return;
    queryClient.invalidateQueries({
      queryKey: trpc.workProjects.get.queryKey({ projectId }),
    });
    queryClient.invalidateQueries({
      queryKey: trpc.workProjects.list.queryKey(),
    });
  }, [projectId, queryClient, trpc]);

  const addTile = useCallback(
    async (
      tile: NewTileInput,
      options: {
        state?: "live" | "pending_add";
        origin?: "user" | "chat";
      } = {},
    ): Promise<WorkProject | null> => {
      if (!projectId) return null;
      const result = await trpcClient.workProjects.addTile.mutate({
        projectId,
        tile,
        state: options.state ?? "live",
        origin: options.origin ?? "user",
      });
      invalidate();
      return result;
    },
    [projectId, invalidate],
  );

  const removeTile = useCallback(
    async (tileId: string): Promise<void> => {
      if (!projectId) return;
      await trpcClient.workProjects.removeTile.mutate({ projectId, tileId });
      invalidate();
    },
    [projectId, invalidate],
  );

  const resizeTile = useCallback(
    async (tileId: string, size: TileSize): Promise<void> => {
      if (!projectId) return;
      await trpcClient.workProjects.resizeTile.mutate({
        projectId,
        tileId,
        size,
      });
      invalidate();
    },
    [projectId, invalidate],
  );

  const moveTile = useCallback(
    async (tileId: string, toIndex: number): Promise<void> => {
      if (!projectId) return;
      await trpcClient.workProjects.moveTile.mutate({
        projectId,
        tileId,
        toIndex,
      });
      invalidate();
    },
    [projectId, invalidate],
  );

  const updateTitleTile = useCallback(
    async (patch: {
      name?: string;
      tagline?: string;
      iconId?: WorkProject["iconId"];
    }): Promise<void> => {
      if (!projectId) return;
      await trpcClient.workProjects.updateTitleTile.mutate({
        projectId,
        ...patch,
      });
      invalidate();
    },
    [projectId, invalidate],
  );

  const updateNoteTile = useCallback(
    async (tileId: string, body: string): Promise<void> => {
      if (!projectId) return;
      await trpcClient.workProjects.updateNoteTile.mutate({
        projectId,
        tileId,
        body,
      });
      invalidate();
    },
    [projectId, invalidate],
  );

  const updateFileTile = useCallback(
    async (
      tileId: string,
      patch: { filename?: string; contents?: string },
    ): Promise<void> => {
      if (!projectId) return;
      await trpcClient.workProjects.updateFileTile.mutate({
        projectId,
        tileId,
        ...patch,
      });
      invalidate();
    },
    [projectId, invalidate],
  );

  const applyPending = useCallback(
    async (tileId: string): Promise<void> => {
      if (!projectId) return;
      await trpcClient.workProjects.applyPendingTile.mutate({
        projectId,
        tileId,
      });
      invalidate();
    },
    [projectId, invalidate],
  );

  const rejectPending = useCallback(
    async (tileId: string): Promise<void> => {
      if (!projectId) return;
      await trpcClient.workProjects.rejectPendingTile.mutate({
        projectId,
        tileId,
      });
      invalidate();
    },
    [projectId, invalidate],
  );

  return {
    project: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    addTile,
    removeTile,
    resizeTile,
    moveTile,
    updateTitleTile,
    updateNoteTile,
    updateFileTile,
    applyPending,
    rejectPending,
  };
}

export async function createProject(input: {
  name?: string;
  fromPrompt?: string;
}): Promise<WorkProject> {
  return await trpcClient.workProjects.create.mutate(input);
}
