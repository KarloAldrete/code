import { useOptionalAuthenticatedClient } from "@features/auth/hooks/authClient";
import { useAuthenticatedQuery } from "@hooks/useAuthenticatedQuery";
import type { Schemas } from "@renderer/api/generated";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

const DESKTOP_FILE_SYSTEM_POLL_INTERVAL_MS = 30_000;
const DESKTOP_FILE_SYSTEM_QUERY_KEY = ["desktop-file-system"] as const;

export function useDesktopFileSystem(options?: { enabled?: boolean }) {
  return useAuthenticatedQuery<Schemas.FileSystem[]>(
    DESKTOP_FILE_SYSTEM_QUERY_KEY,
    (client) => client.getDesktopFileSystem(),
    {
      enabled: options?.enabled ?? true,
      refetchInterval: DESKTOP_FILE_SYSTEM_POLL_INTERVAL_MS,
    },
  );
}

// Create/delete top-level channels on the desktop file system surface. Both
// mutations invalidate the shared query key so the tree refetches immediately
// rather than waiting on the 30s poll.
export function useDesktopFileSystemMutations() {
  const client = useOptionalAuthenticatedClient();
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: DESKTOP_FILE_SYSTEM_QUERY_KEY,
    });
  }, [queryClient]);

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!client) throw new Error("Not authenticated");
      return client.createDesktopFileSystemChannel(name);
    },
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!client) throw new Error("Not authenticated");
      return client.deleteDesktopFileSystem(id);
    },
    onSuccess: invalidate,
  });

  const fileEntryMutation = useMutation({
    mutationFn: async (input: {
      path: string;
      type: string;
      ref?: string;
      href?: string;
    }) => {
      if (!client) throw new Error("Not authenticated");
      return client.createDesktopFileSystemEntry(input);
    },
    onSuccess: invalidate,
  });

  const createChannel = useCallback(
    (name: string) => createMutation.mutateAsync(name),
    [createMutation],
  );

  const deleteChannel = useCallback(
    (id: string) => deleteMutation.mutateAsync(id),
    [deleteMutation],
  );

  const fileEntry = useCallback(
    (input: { path: string; type: string; ref?: string; href?: string }) =>
      fileEntryMutation.mutateAsync(input),
    [fileEntryMutation],
  );

  return {
    createChannel,
    deleteChannel,
    fileEntry,
    isCreating: createMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isFiling: fileEntryMutation.isPending,
  };
}
