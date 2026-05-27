import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zipSync } from "fflate";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ExtensionService } from "./service";

const warnMock = vi.hoisted(() => vi.fn());

vi.mock("../../utils/logger", () => ({
  logger: {
    scope: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: warnMock,
      debug: vi.fn(),
    }),
  },
}));

let tempDir: string;
let zipPath: string;
let appDataPath: string;

function zipEntries(entries: Record<string, string>): Buffer {
  return Buffer.from(
    zipSync(
      Object.fromEntries(
        Object.entries(entries).map(([name, content]) => [
          name,
          [new Uint8Array(Buffer.from(content)), { level: 0 }],
        ]),
      ),
    ),
  );
}

async function writeZip(entries: Record<string, string>): Promise<void> {
  await writeFile(zipPath, zipEntries(entries));
}

function createService(): ExtensionService {
  return new ExtensionService(
    { appDataPath, logsPath: join(tempDir, "logs") },
    { resolve: (relativePath) => join(tempDir, "app", relativePath) },
  );
}

describe("ExtensionService runtime commands", () => {
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "posthog-code-extension-test-"));
    zipPath = join(tempDir, "extension.zip");
    appDataPath = join(tempDir, "appData");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("loads bundled Ralph extension commands", async () => {
    const bundledExtensionsDir = join(tempDir, "app/.vite/build/extensions");
    await cp(
      join(process.cwd(), "../../extensions/ralph-loop"),
      join(bundledExtensionsDir, "ralph-loop"),
      { recursive: true },
    );
    const repoPath = join(tempDir, "repo");
    const service = createService();

    await expect(service.listCommands()).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          extensionId: "posthog-ralph-loop",
          name: "ralph-start",
          description: "Start a Ralph loop",
        }),
        expect.objectContaining({
          extensionId: "posthog-ralph-loop",
          name: "ralph-done",
          description: "Advance the active Ralph loop",
        }),
      ]),
    );

    const startResult = await service.executeCommand({
      name: "ralph-start",
      args: "demo Test the Ralph extension --items-per-iteration 2",
      repoPath,
    });

    expect(startResult.message).toBe("Started Ralph loop demo");
    expect(startResult.prompt).toContain("RALPH LOOP: demo | Iteration 1/50");
    await expect(
      readFile(join(repoPath, ".ralph/demo.md"), "utf-8"),
    ).resolves.toContain("Test the Ralph extension");
    await expect(service.listStatusBar()).resolves.toEqual([
      expect.objectContaining({
        extensionId: "posthog-ralph-loop",
        id: "posthog-ralph-loop.ralph-status",
        location: "status-bar",
        title: "Ralph Loop Status",
        entry: "views/status-bar/build/index.html",
        priority: 100,
        width: 190,
      }),
    ]);
    await expect(
      service.handleViewMessage({
        viewId: "posthog-ralph-loop.ralph-status",
        message: { type: "ralph.status" },
        repoPath,
      }),
    ).resolves.toEqual({
      handled: true,
      payload: {
        state: "active",
        label: "Ralph: demo 1/50",
        tooltip: "Ralph loop demo: active at iteration 1/50",
      },
    });

    const tools = await service.getAgentTools();
    expect(tools.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(["ralph_start", "ralph_done"]),
    );

    const ralphDone = tools.find((tool) => tool.name === "ralph_done");
    await expect(
      ralphDone?.handler(
        {},
        { cwd: repoPath, taskId: "task-1", taskRunId: "run-1" },
      ),
    ).resolves.toContain("RALPH LOOP: demo | Iteration 2/50");
  });

  it("loads JavaScript extension runtimes and executes registered commands", async () => {
    await writeZip({
      "package.json": JSON.stringify({
        name: "runtime-command-extension",
        posthogCode: { extensions: ["extensions/index.cjs"] },
      }),
      "extensions/index.cjs": `
        module.exports = function (posthogCode) {
          posthogCode.registerCommand("hello", {
            description: "Say hello",
            argumentHint: "name",
            handler(args, ctx) {
              return {
                message: "Hello " + (args || "world") + " from " + ctx.extensionId + " in " + ctx.repoPath,
                prompt: "Generated prompt for " + (args || "world"),
              }
            },
          })
          posthogCode.registerView("dashboard", {
            location: "sidebar",
            title: "Runtime Dashboard",
            icon: "sparkle",
            html: "<h1>Runtime Dashboard</h1>",
          })
          posthogCode.registerView("status", {
            location: "status-bar",
            title: "Runtime Status",
            html: "<span>Status</span>",
            priority: 10,
            width: 120,
            onMessage(message, ctx) {
              return { message, viewId: ctx.viewId, location: ctx.location }
            },
          })
        }
      `,
    });
    const service = createService();

    await service.installFromZip(zipPath);
    expect(
      existsSync(
        join(
          appDataPath,
          "extensions/runtime-command-extension/extensions/index.cjs",
        ),
      ),
    ).toBe(true);
    expect(warnMock).not.toHaveBeenCalled();

    await expect(service.listCommands()).resolves.toEqual([
      {
        extensionId: "runtime-command-extension",
        name: "hello",
        description: "Say hello",
        input: { hint: "name" },
      },
    ]);
    await expect(service.listSidebar()).resolves.toEqual([
      {
        extensionId: "runtime-command-extension",
        id: "runtime-command-extension.dashboard",
        location: "sidebar",
        title: "Runtime Dashboard",
        icon: "sparkle",
        entry: undefined,
        url: undefined,
        html: "<h1>Runtime Dashboard</h1>",
      },
    ]);
    await expect(service.listStatusBar()).resolves.toEqual([
      {
        extensionId: "runtime-command-extension",
        id: "runtime-command-extension.status",
        location: "status-bar",
        title: "Runtime Status",
        entry: undefined,
        url: undefined,
        html: "<span>Status</span>",
        priority: 10,
        width: 120,
      },
    ]);
    await expect(
      service.handleViewMessage({
        viewId: "runtime-command-extension.status",
        message: { hello: "world" },
        repoPath: "/repo",
      }),
    ).resolves.toEqual({
      handled: true,
      payload: {
        message: { hello: "world" },
        viewId: "runtime-command-extension.status",
        location: "status-bar",
      },
    });

    await expect(
      service.executeCommand({
        name: "hello",
        args: "Max",
        taskId: "task-1",
        repoPath: "/repo",
      }),
    ).resolves.toEqual({
      handled: true,
      message: "Hello Max from runtime-command-extension in /repo",
      prompt: "Generated prompt for Max",
    });
  });
});
