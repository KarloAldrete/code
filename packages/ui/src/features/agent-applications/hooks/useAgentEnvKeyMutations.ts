import { useAuthenticatedClient } from "@posthog/ui/features/auth/authClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStateValue } from "../../auth/store";
import { agentApplicationsKeys } from "./agentApplicationsKeys";

/**
 * Set/rotate and clear one agent env key. Both invalidate the env-keys list so
 * set/not-set status (tree badges, secret detail) reflects the change.
 */
export function useAgentEnvKeyMutations(idOrSlug: string) {
  const client = useAuthenticatedClient();
  const queryClient = useQueryClient();
  const projectId = useAuthStateValue((state) => state.currentProjectId);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: agentApplicationsKeys.envKeys(projectId, idOrSlug),
    });

  const setKey = useMutation<void, Error, { key: string; value: string }>({
    mutationFn: ({ key, value }) => client.setAgentEnvKey(idOrSlug, key, value),
    onSuccess: () => void invalidate(),
  });
  const clearKey = useMutation<void, Error, { key: string }>({
    mutationFn: ({ key }) => client.clearAgentEnvKey(idOrSlug, key),
    onSuccess: () => void invalidate(),
  });

  return { setKey, clearKey };
}
