import type { AppRouter } from "@posthog/workspace-server/trpc";
import type { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { type ReactNode, useMemo } from "react";
import superjson from "superjson";
import type { WorkspaceConnection } from "./client";
import { WorkspaceTRPCProvider } from "./trpc";

const SECRET_HEADER = "x-workspace-secret";
const UNAVAILABLE_URL = "http://127.0.0.1:1/trpc-unavailable";

export interface WorkspaceClientProviderProps {
  connection: WorkspaceConnection | null | undefined;
  queryClient: QueryClient;
  children: ReactNode;
}

export function WorkspaceClientProvider({
  connection,
  queryClient,
  children,
}: WorkspaceClientProviderProps) {
  const url = connection?.url;
  const secret = connection?.secret;

  const client = useMemo(
    () =>
      createTRPCClient<AppRouter>({
        links: [
          httpBatchLink({
            transformer: superjson,
            url: url ? `${url.replace(/\/$/, "")}/trpc` : UNAVAILABLE_URL,
            headers: () => (secret ? { [SECRET_HEADER]: secret } : {}),
          }),
        ],
      }),
    [url, secret],
  );

  return (
    <WorkspaceTRPCProvider trpcClient={client} queryClient={queryClient}>
      {children}
    </WorkspaceTRPCProvider>
  );
}
