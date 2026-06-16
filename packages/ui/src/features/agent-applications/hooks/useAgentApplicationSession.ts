import type { AgentApplicationSessionDetail } from "@posthog/shared/agent-platform-types";
import { useAuthenticatedQuery } from "@posthog/ui/hooks/useAuthenticatedQuery";
import { useAuthStateValue } from "../../auth/store";
import { agentApplicationsKeys } from "./agentApplicationsKeys";

/** Fetches one session's detail, including its stored conversation transcript. */
export function useAgentApplicationSession(
  idOrSlug: string,
  sessionId: string,
  lastN?: number,
) {
  const projectId = useAuthStateValue((state) => state.currentProjectId);
  return useAuthenticatedQuery<AgentApplicationSessionDetail | null>(
    [
      ...agentApplicationsKeys.session(projectId, idOrSlug, sessionId),
      lastN ?? null,
    ],
    (client) =>
      projectId
        ? client.getAgentApplicationSession(idOrSlug, sessionId, lastN)
        : Promise.resolve(null),
    { enabled: !!projectId && !!idOrSlug && !!sessionId, staleTime: 15_000 },
  );
}
