import type { AppRouter } from "@posthog/workspace-server/trpc";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

const SECRET_HEADER = "x-workspace-secret";

export interface WorkspaceConnection {
  url: string;
  secret: string;
}

export type WorkspaceClient = ReturnType<typeof createWorkspaceClient>;

export function createWorkspaceClient(connection: WorkspaceConnection) {
  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${connection.url.replace(/\/$/, "")}/trpc`,
        transformer: superjson,
        headers: () => ({ [SECRET_HEADER]: connection.secret }),
      }),
    ],
  });
}
