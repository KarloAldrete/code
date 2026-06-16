import { AgentApprovalsPane } from "@posthog/ui/features/agent-applications/components/AgentApprovalsPane";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/code/agents/applications/$idOrSlug/approvals",
)({
  component: AgentApprovalsRoute,
});

function AgentApprovalsRoute() {
  const { idOrSlug } = Route.useParams();
  return <AgentApprovalsPane idOrSlug={idOrSlug} />;
}
