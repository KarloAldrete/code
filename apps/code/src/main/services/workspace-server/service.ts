import { type ChildProcess, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import path from "node:path";
import { TypedEventEmitter } from "@posthog/shared";
import type { WorkspaceConnection } from "@posthog/workspace-client/client";
import { injectable } from "inversify";
import { logger } from "../../utils/logger.js";

const HEALTH_POLL_INTERVAL_MS = 100;
// Cold starts (slow disks, AV scanning the freshly-spawned node binary) can take
// several seconds to bind. fail-fast on early child exit means a healthy server
// still returns the moment it is reachable, so a generous ceiling only helps the
// genuinely-slow case rather than penalising the common one.
const HEALTH_POLL_TIMEOUT_MS = 15_000;
const SHUTDOWN_GRACE_MS = 3_000;
// Bounded respawn: the dominant transient failure is a port stolen between
// findFreePort() releasing it and the child re-binding, which surfaces as an
// early exit. Retrying picks a fresh port and self-heals that race.
const MAX_SPAWN_ATTEMPTS = 3;
const STDERR_CAPTURE_LIMIT = 8_192;

const log = logger.scope("workspace-server");

export const WorkspaceServerEvent = {
  ConnectionLost: "connectionLost",
} as const;

export interface WorkspaceServerEvents {
  [WorkspaceServerEvent.ConnectionLost]: {
    code: number | null;
    signal: NodeJS.Signals | null;
  };
}

interface ChildExit {
  code: number | null;
  signal: NodeJS.Signals | null;
  error?: Error;
}

class WorkspaceServerStartError extends Error {
  readonly retriable: boolean;
  constructor(message: string, retriable: boolean) {
    super(message);
    this.name = "WorkspaceServerStartError";
    this.retriable = retriable;
  }
}

@injectable()
export class WorkspaceServerService extends TypedEventEmitter<WorkspaceServerEvents> {
  private readonly scriptPath = path.join(__dirname, "workspace-server.js");
  private child: ChildProcess | null = null;
  private connection: WorkspaceConnection | null = null;
  private pendingStart: Promise<WorkspaceConnection> | null = null;

  getConnection(): WorkspaceConnection | null {
    return this.connection;
  }

  start(): Promise<WorkspaceConnection> {
    if (this.connection) return Promise.resolve(this.connection);
    if (this.pendingStart) return this.pendingStart;

    this.pendingStart = this.spawnWithRetries().finally(() => {
      this.pendingStart = null;
    });
    return this.pendingStart;
  }

  stop(): void {
    if (!this.child) return;
    const c = this.child;
    this.child = null;
    this.connection = null;
    try {
      c.kill("SIGTERM");
    } catch {}
    setTimeout(() => {
      try {
        c.kill("SIGKILL");
      } catch {}
    }, SHUTDOWN_GRACE_MS).unref();
  }

  private async spawnWithRetries(): Promise<WorkspaceConnection> {
    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= MAX_SPAWN_ATTEMPTS; attempt++) {
      try {
        return await this.spawnChild();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const retriable =
          err instanceof WorkspaceServerStartError &&
          err.retriable &&
          attempt < MAX_SPAWN_ATTEMPTS;
        log.warn("workspace-server start attempt failed", {
          attempt,
          maxAttempts: MAX_SPAWN_ATTEMPTS,
          willRetry: retriable,
          error: lastError.message,
        });
        if (!retriable) break;
      }
    }
    throw lastError ?? new Error("workspace-server failed to start");
  }

  private async spawnChild(): Promise<WorkspaceConnection> {
    const port = await findFreePort();
    const secret = randomBytes(32).toString("hex");
    const url = `http://127.0.0.1:${port}`;

    const c = spawn(process.execPath, [this.scriptPath], {
      detached: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        WORKSPACE_SERVER_SECRET: secret,
        WORKSPACE_SERVER_PORT: String(port),
        WORKSPACE_SERVER_PARENT_PID: String(process.pid),
      },
      windowsHide: true,
    });
    this.child = c;

    // Capture a bounded tail of stderr so a child that dies during boot
    // (env validation -> process.exit(2), EADDRINUSE, bundle errors) reports
    // the real cause instead of an opaque timeout.
    let stderrTail = "";
    const exited = new Promise<ChildExit>((resolve) => {
      c.once("error", (error) => resolve({ code: null, signal: null, error }));
      c.once("exit", (code, signal) => resolve({ code, signal }));
    });

    c.stdout?.on("data", (chunk) => process.stdout.write(chunk));
    c.stderr?.on("data", (chunk) => {
      process.stderr.write(chunk);
      stderrTail = (stderrTail + String(chunk)).slice(-STDERR_CAPTURE_LIMIT);
    });
    c.once("exit", (code, signal) => {
      if (this.child !== c) return;
      const wasConnected = this.connection !== null;
      this.child = null;
      this.connection = null;
      log.info("child exited", { code, signal });
      if (wasConnected) {
        this.emit(WorkspaceServerEvent.ConnectionLost, { code, signal });
      }
    });

    // Race readiness against death: stop polling the instant the child exits
    // rather than waiting out the full timeout against a dead port.
    const abort = new AbortController();
    const outcome = await Promise.race([
      pollHealth(url, abort.signal).then(
        (ok) => ({ kind: "health", ok }) as const,
      ),
      exited.then((exit) => {
        abort.abort();
        return { kind: "exit", exit } as const;
      }),
    ]);

    if (outcome.kind === "exit") {
      throw new WorkspaceServerStartError(
        describeEarlyExit(outcome.exit, stderrTail),
        true,
      );
    }

    if (!outcome.ok) {
      this.stop();
      const tail = stderrTail.trim();
      throw new WorkspaceServerStartError(
        `workspace-server failed to become healthy within ${HEALTH_POLL_TIMEOUT_MS}ms${
          tail ? `; last stderr: ${tail}` : ""
        }`,
        false,
      );
    }

    this.connection = { url, secret };
    return this.connection;
  }
}

function describeEarlyExit(exit: ChildExit, stderrTail: string): string {
  const parts = ["workspace-server exited before becoming healthy"];
  if (exit.error) parts.push(`spawn error: ${exit.error.message}`);
  if (exit.code !== null) parts.push(`exit code ${exit.code}`);
  if (exit.signal) parts.push(`signal ${exit.signal}`);
  const tail = stderrTail.trim();
  if (tail) parts.push(`stderr: ${tail}`);
  return parts.join("; ");
}

async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.unref();
    s.on("error", reject);
    s.listen(0, "127.0.0.1", () => {
      const a = s.address();
      if (!a || typeof a === "string") {
        s.close();
        reject(new Error("failed to allocate port"));
        return;
      }
      const port = a.port;
      s.close(() => resolve(port));
    });
  });
}

async function pollHealth(url: string, signal: AbortSignal): Promise<boolean> {
  const deadline = Date.now() + HEALTH_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (signal.aborted) return false;
    try {
      if ((await fetch(`${url}/health`, { signal })).ok) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, HEALTH_POLL_INTERVAL_MS));
  }
  return false;
}
