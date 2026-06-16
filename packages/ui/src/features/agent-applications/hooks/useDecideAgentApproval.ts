import type {
  AgentApprovalRequest,
  DecideApprovalRequest,
} from "@posthog/shared/agent-platform-types";
import { useAuthenticatedClient } from "@posthog/ui/features/auth/authClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStateValue } from "../../auth/store";

interface DecideArgs {
  approvalId: string;
  body: DecideApprovalRequest;
}

/**
 * Approve or reject a queued tool-approval request. On success, refetches the
 * agent's approval lists (all state filters) so the row reflects its outcome.
 */
export function useDecideAgentApproval(idOrSlug: string) {
  const client = useAuthenticatedClient();
  const queryClient = useQueryClient();
  const projectId = useAuthStateValue((state) => state.currentProjectId);

  return useMutation<AgentApprovalRequest, Error, DecideArgs>({
    mutationFn: ({ approvalId, body }) =>
      client.decideAgentApproval(idOrSlug, approvalId, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["agent-applications", "approvals", projectId, idOrSlug],
      });
    },
  });
}
