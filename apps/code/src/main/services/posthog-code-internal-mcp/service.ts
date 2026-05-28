import { randomBytes } from "node:crypto";
import http from "node:http";
import * as path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { injectable, preDestroy } from "inversify";
import { trpcRouter } from "../../trpc/router";
import { logger } from "../../utils/logger";
import { McpToolRegistry } from "./tool-registry";

const log = logger.scope("posthog-code-internal-mcp");

const SERVER_NAME = "posthog-code-internal";
const SERVER_VERSION = "1.0.0";

const YAML_PATH = path.join(__dirname, "mcp-tools.yaml");

/**
 * Local-only HTTP MCP server that exposes a curated subset of the app's
 * tRPC router to the running agent. The bridge from tRPC procedure to MCP
 * tool is driven entirely by `mcp-tools.yaml` — see {@link McpToolRegistry}.
 *
 * Mirrors `McpProxyService`: listens on 127.0.0.1, generates a random bearer
 * token at boot, and dies with the app via `@preDestroy`. Configuration is
 * loaded once at start; YAML or procedure changes require an app restart.
 */
@injectable()
export class PostHogCodeInternalMcpService {
  private server: http.Server | null = null;
  private port: number | null = null;
  private bearerToken: string | null = null;
  private startPromise: Promise<void> | null = null;
  private registry: McpToolRegistry | null = null;

  async start(): Promise<void> {
    if (this.server && this.port) return;
    if (this.startPromise) return this.startPromise;
    this.startPromise = this.doStart().catch((err) => {
      this.startPromise = null;
      throw err;
    });
    return this.startPromise;
  }

  @preDestroy()
  async stop(): Promise<void> {
    if (!this.server) return;
    const server = this.server;
    await new Promise<void>((resolve) => {
      server.close(() => {
        log.info("PostHog Code internal MCP stopped");
        resolve();
      });
    });
    this.server = null;
    this.port = null;
    this.bearerToken = null;
    this.startPromise = null;
    this.registry = null;
  }

  getUrl(): string {
    if (!this.port) {
      throw new Error("posthog-code-internal MCP server not started");
    }
    return `http://127.0.0.1:${this.port}/mcp`;
  }

  getAuthHeader(): { name: string; value: string } {
    if (!this.bearerToken) {
      throw new Error("posthog-code-internal MCP server not started");
    }
    return { name: "authorization", value: `Bearer ${this.bearerToken}` };
  }

  private async doStart(): Promise<void> {
    // Build the registry before we listen — any YAML/router mismatch should
    // fail the whole service start with a readable error in main logs.
    this.registry = McpToolRegistry.build({
      router: trpcRouter,
      yamlPath: YAML_PATH,
    });

    this.bearerToken = randomBytes(32).toString("hex");

    const server = http.createServer((req, res) => {
      void this.handleRequest(req, res);
    });
    this.server = server;

    await new Promise<void>((resolve, reject) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (typeof addr === "object" && addr) {
          this.port = addr.port;
          log.info("PostHog Code internal MCP started", { port: this.port });
          resolve();
        } else {
          reject(new Error("Failed to get internal MCP address"));
        }
      });
      server.on("error", (err) => {
        log.error("Internal MCP server error", err);
        reject(err);
      });
    });
  }

  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    const auth = req.headers.authorization;
    if (!auth || auth !== `Bearer ${this.bearerToken}`) {
      res.writeHead(401).end("Unauthorized");
      return;
    }

    let mcpServer: McpServer | null = null;
    let transport: StreamableHTTPServerTransport | null = null;
    try {
      // Stateless per-request: each HTTP request gets a fresh server +
      // transport. Avoids cross-request session state and matches the SDK's
      // documented stateless pattern.
      mcpServer = this.buildServer();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      const owned = { mcpServer, transport };
      res.on("close", () => {
        try {
          owned.transport.close();
        } catch {}
        try {
          owned.mcpServer.close();
        } catch {}
      });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);
    } catch (err) {
      log.error("Internal MCP request error", err);
      try {
        transport?.close();
      } catch {}
      try {
        mcpServer?.close();
      } catch {}
      if (!res.headersSent) {
        res.writeHead(500).end("Internal error");
      } else {
        res.end();
      }
    }
  }

  private buildServer(): McpServer {
    if (!this.registry) {
      throw new Error("posthog-code-internal MCP registry not initialized");
    }
    const server = new McpServer(
      { name: SERVER_NAME, version: SERVER_VERSION },
      { capabilities: { tools: {} } },
    );
    this.registry.registerAll(server, trpcRouter);
    return server;
  }
}
