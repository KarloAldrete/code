import { inject, injectable, preDestroy } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { logger } from "../../utils/logger";
import { TypedEventEmitter } from "../../utils/typed-event-emitter";
import type { AuthService } from "../auth/service";
import {
  type InstallCustomInput,
  type InstallCustomOutput,
  type ListMcpInstallationsOutput,
  McpInstallationsServiceEvent,
  type McpInstallationsServiceEvents,
} from "./schemas";

const log = logger.scope("mcp-installations");

const OAUTH_POLL_INTERVAL_MS = 3000;
const OAUTH_POLL_TIMEOUT_MS = 10 * 60 * 1000;

function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Owns the PostHog REST surface for MCP server installations on the active
 * project. Reads/writes against `/api/environments/{projectId}/mcp_server_installations/`.
 *
 * Emits {@link McpInstallationsServiceEvent.Installed} once an installation
 * becomes usable — either immediately for api_key installs, or after the
 * background OAuth poll observes `pending_oauth: false`.
 */
@injectable()
export class McpInstallationsService extends TypedEventEmitter<McpInstallationsServiceEvents> {
  // Aborts any in-flight OAuth polls when the app shuts down so we don't
  // keep authenticated HTTP requests running for up to 10 minutes after quit.
  private readonly shutdown = new AbortController();

  constructor(
    @inject(MAIN_TOKENS.AuthService)
    private readonly authService: AuthService,
  ) {
    super();
  }

  @preDestroy()
  stop(): void {
    this.shutdown.abort();
  }

  async list(): Promise<ListMcpInstallationsOutput> {
    const { baseUrl, projectId } = await this.requireProject();
    const url = `${baseUrl}/api/environments/${projectId}/mcp_server_installations/`;
    const response = await this.authService.authenticatedFetch(fetch, url, {
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      throw new Error(
        `Failed to list MCP servers (${response.status}): ${errText.slice(0, 500)}`,
      );
    }
    const data = (await response.json()) as {
      results?: Array<{
        id: string;
        name?: string;
        display_name?: string;
        url?: string;
        auth_type?: string;
        is_enabled?: boolean;
        pending_oauth?: boolean;
        needs_reauth?: boolean;
      }>;
    };
    const servers = (data.results ?? []).map((i) => ({
      id: i.id,
      name: i.name ?? i.display_name ?? "(unnamed)",
      url: i.url ?? "",
      auth_type: i.auth_type ?? "unknown",
      is_enabled: i.is_enabled !== false,
      pending_oauth: !!i.pending_oauth,
      needs_reauth: !!i.needs_reauth,
    }));
    return { servers };
  }

  async installCustom(input: InstallCustomInput): Promise<InstallCustomOutput> {
    const { baseUrl, projectId } = await this.requireProject();
    const url = `${baseUrl}/api/environments/${projectId}/mcp_server_installations/install_custom/`;
    const response = await this.authService.authenticatedFetch(fetch, url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: input.name,
        url: input.url,
        auth_type: input.auth_type,
        api_key: input.api_key,
        description: input.description,
        install_source: "posthog-code",
      }),
    });
    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return {
        kind: "error",
        status: response.status,
        message: `Failed to install MCP server (${response.status}): ${errText.slice(0, 500)}`,
      };
    }
    const data = (await response.json()) as Record<string, unknown>;
    const id = typeof data.id === "string" ? data.id : undefined;
    if (typeof data.redirect_url === "string") {
      void this.pollForOauthCompletion(id, input.name);
      return {
        kind: "oauth",
        id,
        redirectUrl: data.redirect_url,
        message: `OAuth flow required. The user must visit: ${data.redirect_url} to finish installing "${input.name}". Once authorized, the session will refresh automatically.`,
      };
    }
    this.emit(McpInstallationsServiceEvent.Installed, {});
    return {
      kind: "ok",
      id: id ?? "unknown",
      message: `Installed MCP server "${input.name}" (id=${id ?? "unknown"}). Refreshing session to make it available immediately.`,
    };
  }

  private async requireProject(): Promise<{
    baseUrl: string;
    projectId: number;
  }> {
    const { apiHost } = await this.authService.getValidAccessToken();
    const projectId = this.authService.getState().projectId;
    if (!projectId) {
      throw new Error(
        "No project selected. Sign in and pick a project before listing MCP servers.",
      );
    }
    return {
      baseUrl: apiHost.replace(/\/+$/, ""),
      projectId,
    };
  }

  private async pollForOauthCompletion(
    installationId: string | undefined,
    name: string,
  ): Promise<void> {
    const signal = this.shutdown.signal;
    if (signal.aborted) return;
    const { apiHost } = await this.authService.getValidAccessToken();
    const projectId = this.authService.getState().projectId;
    if (!projectId) return;
    const baseUrl = apiHost.replace(/\/+$/, "");
    const url = `${baseUrl}/api/environments/${projectId}/mcp_server_installations/`;

    log.info("Polling for OAuth completion", { installationId, name });

    const start = Date.now();
    while (Date.now() - start < OAUTH_POLL_TIMEOUT_MS) {
      try {
        await wait(OAUTH_POLL_INTERVAL_MS, signal);
      } catch {
        log.info("OAuth poll aborted (shutdown)", { installationId, name });
        return;
      }

      try {
        const response = await this.authService.authenticatedFetch(fetch, url, {
          headers: { "Content-Type": "application/json" },
          signal,
        });
        if (!response.ok) continue;
        const data = (await response.json()) as {
          results?: Array<{
            id: string;
            name?: string;
            display_name?: string;
            pending_oauth?: boolean;
            is_enabled?: boolean;
          }>;
        };
        const inst = (data.results ?? []).find((i) =>
          installationId
            ? i.id === installationId
            : i.name === name || i.display_name === name,
        );
        if (!inst) {
          log.info("OAuth installation no longer in list, stopping poll", {
            installationId,
            name,
          });
          return;
        }
        if (!inst.pending_oauth && inst.is_enabled !== false) {
          log.info("OAuth install completed, triggering session refresh", {
            installationId: inst.id,
            name,
          });
          this.emit(McpInstallationsServiceEvent.Installed, {});
          return;
        }
      } catch (err) {
        if (signal.aborted) {
          log.info("OAuth poll aborted (shutdown)", { installationId, name });
          return;
        }
        log.warn("OAuth poll error", { err });
      }
    }
    log.info("OAuth poll timed out", { installationId, name });
  }
}
