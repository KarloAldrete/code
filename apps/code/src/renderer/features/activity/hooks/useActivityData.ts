import { useAuthStateValue } from "@features/auth/hooks/authQueries";
import { useAuthenticatedQuery } from "@hooks/useAuthenticatedQuery";
import type { Schemas } from "@renderer/api/generated";

export function useEventsList(opts: { event?: string }) {
  const projectId = useAuthStateValue((s) => s.projectId);
  return useAuthenticatedQuery<Schemas.PaginatedClickhouseEventList>(
    ["activity", "events", projectId, opts.event ?? ""],
    (client) =>
      client.listEvents({ limit: 50, event: opts.event || undefined }),
    { staleTime: 30_000 },
  );
}

export function useRecordingsList() {
  const projectId = useAuthStateValue((s) => s.projectId);
  return useAuthenticatedQuery<Schemas.PaginatedSessionRecordingList>(
    ["activity", "recordings", projectId],
    (client) => client.listSessionRecordings({ limit: 50 }),
    { staleTime: 30_000 },
  );
}

export function usePersonsList(opts: { search?: string }) {
  const projectId = useAuthStateValue((s) => s.projectId);
  return useAuthenticatedQuery<Schemas.PaginatedPersonRecordList>(
    ["activity", "persons", projectId, opts.search ?? ""],
    (client) =>
      client.listPersons({ limit: 50, search: opts.search || undefined }),
    { staleTime: 30_000 },
  );
}
