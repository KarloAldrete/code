import { z } from "zod";

export const mcpServerInstallation = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  auth_type: z.string(),
  is_enabled: z.boolean(),
  pending_oauth: z.boolean(),
  needs_reauth: z.boolean(),
});

export type McpServerInstallation = z.infer<typeof mcpServerInstallation>;

export const listMcpInstallationsOutput = z.object({
  servers: z.array(mcpServerInstallation),
});

export type ListMcpInstallationsOutput = z.infer<
  typeof listMcpInstallationsOutput
>;

export const installCustomInput = z.object({
  name: z
    .string()
    .min(1)
    .describe("Display name for the MCP server installation."),
  url: z.string().url().describe("HTTPS URL of the MCP server endpoint."),
  auth_type: z
    .enum(["api_key", "oauth"])
    .default("api_key")
    .describe(
      "Authentication scheme. Use 'api_key' with `api_key` for static bearer tokens; use 'oauth' to start an OAuth handshake (response will include redirectUrl).",
    ),
  api_key: z
    .string()
    .optional()
    .describe(
      "Static bearer token. Required when auth_type='api_key' and the target server requires authentication.",
    ),
  description: z.string().optional(),
});

export type InstallCustomInput = z.infer<typeof installCustomInput>;

export const installCustomOk = z.object({
  kind: z.literal("ok"),
  id: z.string(),
  message: z.string(),
});

export const installCustomOAuth = z.object({
  kind: z.literal("oauth"),
  id: z.string().optional(),
  redirectUrl: z.string(),
  message: z.string(),
});

export const installCustomError = z.object({
  kind: z.literal("error"),
  status: z.number().optional(),
  message: z.string(),
});

export const installCustomOutput = z.discriminatedUnion("kind", [
  installCustomOk,
  installCustomOAuth,
  installCustomError,
]);

export type InstallCustomOutput = z.infer<typeof installCustomOutput>;

export const McpInstallationsServiceEvent = {
  Installed: "installed",
} as const;

export interface McpInstallationsServiceEvents {
  [McpInstallationsServiceEvent.Installed]: Record<never, never>;
}
