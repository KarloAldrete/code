import { ConciergeDockLayout } from "@posthog/ui/features/agent-applications/concierge/ConciergeDockLayout";
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/code/agents")({
  component: AgentsLayout,
});

function AgentsLayout() {
  return (
    <ConciergeDockLayout>
      <Outlet />
    </ConciergeDockLayout>
  );
}
