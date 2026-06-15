import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/logger.js", () => ({
  logger: {
    scope: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

const spawnMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({
  spawn: spawnMock,
  default: { spawn: spawnMock },
}));

let nextPort = 5000;
const createServerMock = vi.hoisted(() => vi.fn());
vi.mock("node:net", () => ({
  createServer: createServerMock,
  default: { createServer: createServerMock },
}));

import { WorkspaceServerService } from "./service";

interface FakeChild extends EventEmitter {
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
  pid: number;
}

function makeFakeChild(): FakeChild {
  const child = new EventEmitter() as FakeChild;
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  child.pid = 4242;
  return child;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  nextPort = 5000;
  createServerMock.mockImplementation(() => {
    const port = ++nextPort;
    return {
      unref: () => {},
      on: () => {},
      listen: (_p: number, _host: string, cb: () => void) => cb(),
      address: () => ({ port }),
      close: (cb?: () => void) => cb?.(),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WorkspaceServerService", () => {
  it("resolves the connection once the child reports healthy", async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    fetchMock.mockResolvedValue({ ok: true });

    const service = new WorkspaceServerService();
    const conn = await service.start();

    expect(spawnMock).toHaveBeenCalledTimes(1);
    expect(conn.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(conn.secret).toHaveLength(64);
  });

  it("surfaces the child's exit code and stderr instead of an opaque timeout", async () => {
    spawnMock.mockImplementation(() => {
      const child = makeFakeChild();
      setTimeout(() => {
        child.stderr.emit(
          "data",
          Buffer.from(
            "[workspace-server] missing or invalid WORKSPACE_SERVER_SECRET / WORKSPACE_SERVER_PORT\n",
          ),
        );
        child.emit("exit", 2, null);
      }, 0);
      return child;
    });
    // Never healthy: the failure must come from the child exit, not the timeout.
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

    const service = new WorkspaceServerService();
    await expect(service.start()).rejects.toThrow(
      /exited before becoming healthy.*exit code 2.*WORKSPACE_SERVER_SECRET/s,
    );
    // Early exit is treated as retriable (e.g. a stolen port), so we exhaust attempts.
    expect(spawnMock).toHaveBeenCalledTimes(3);
  });

  it("recovers by respawning on a fresh port after an early exit", async () => {
    let serverAlive = false;
    spawnMock.mockImplementation(() => {
      const child = makeFakeChild();
      if (spawnMock.mock.calls.length === 1) {
        setTimeout(() => {
          child.stderr.emit("data", Buffer.from("Error: listen EADDRINUSE\n"));
          child.emit("exit", 1, null);
        }, 0);
      } else {
        serverAlive = true;
      }
      return child;
    });
    fetchMock.mockImplementation(async () => {
      if (!serverAlive) throw new Error("ECONNREFUSED");
      return { ok: true };
    });

    const service = new WorkspaceServerService();
    const conn = await service.start();

    expect(spawnMock).toHaveBeenCalledTimes(2);
    expect(conn.secret).toHaveLength(64);
  });
});
