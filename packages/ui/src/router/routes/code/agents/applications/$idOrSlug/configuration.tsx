import { AgentConfigurationPane } from "@posthog/ui/features/agent-applications/components/AgentConfigurationPane";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/code/agents/applications/$idOrSlug/configuration",
)({
  validateSearch: (search: Record<string, unknown>): { node?: string } => ({
    node: typeof search.node === "string" ? search.node : undefined,
  }),
  component: AgentConfigurationRoute,
});

function AgentConfigurationRoute() {
  const { idOrSlug } = Route.useParams();
  const { node } = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <AgentConfigurationPane
      idOrSlug={idOrSlug}
      selectedNode={node ?? null}
      onSelectNode={(next) =>
        navigate({ search: (prev) => ({ ...prev, node: next }) })
      }
    />
  );
}
