import { useAuthenticatedQuery } from "@hooks/useAuthenticatedQuery";
import type { Schemas } from "@renderer/api/generated";

const DESKTOP_FILE_SYSTEM_POLL_INTERVAL_MS = 30_000;

export function useDesktopFileSystem(options?: { enabled?: boolean }) {
  return useAuthenticatedQuery<Schemas.FileSystem[]>(
    ["desktop-file-system"],
    (client) => client.getDesktopFileSystem(),
    {
      enabled: options?.enabled ?? true,
      refetchInterval: DESKTOP_FILE_SYSTEM_POLL_INTERVAL_MS,
    },
  );
}
