import { useAuthenticatedQuery } from "@posthog/ui/hooks/useAuthenticatedQuery";
import { useAuthStateValue } from "../../auth/store";
import { agentApplicationsKeys } from "./agentApplicationsKeys";

/** Names of env keys currently set on an agent (values are never returned). */
export function useAgentEnvKeys(idOrSlug: string) {
  const projectId = useAuthStateValue((state) => state.currentProjectId);
  return useAuthenticatedQuery<string[]>(
    agentApplicationsKeys.envKeys(projectId, idOrSlug),
    (client) => client.listAgentEnvKeys(idOrSlug),
    { enabled: !!projectId && !!idOrSlug, staleTime: 15_000 },
  );
}
