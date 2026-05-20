import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPlanFilePathFromSessionUpdate } from "./plan-file-detector";

function buildToolCall(toolName: string, filePath: string) {
  return {
    method: "session/update",
    params: {
      update: {
        sessionUpdate: "tool_call",
        toolCallId: "tc-1",
        rawInput: { file_path: filePath },
        _meta: { claudeCode: { toolName } },
      },
    },
  };
}

describe("getPlanFilePathFromSessionUpdate", () => {
  let savedConfigDir: string | undefined;

  beforeEach(() => {
    savedConfigDir = process.env.CLAUDE_CONFIG_DIR;
  });

  afterEach(() => {
    if (savedConfigDir === undefined) {
      delete process.env.CLAUDE_CONFIG_DIR;
    } else {
      process.env.CLAUDE_CONFIG_DIR = savedConfigDir;
    }
  });

  it("returns the file path for Write/Edit calls inside the plans dir", () => {
    process.env.CLAUDE_CONFIG_DIR = "/var/data/claude";
    const planPath = "/var/data/claude/plans/my-plan.md";
    expect(
      getPlanFilePathFromSessionUpdate(buildToolCall("Write", planPath)),
    ).toBe(planPath);
    expect(
      getPlanFilePathFromSessionUpdate(buildToolCall("Edit", planPath)),
    ).toBe(planPath);
  });

  it("respects CLAUDE_CONFIG_DIR — the canonical source for the plans dir", () => {
    // This is the core P1 fix: the regex-based renderer code required a leading
    // dot (`.claude`) which the desktop app does not use. The main-process
    // detector reads the same env var that env.ts sets at boot.
    process.env.CLAUDE_CONFIG_DIR = "/var/data/claude";
    expect(
      getPlanFilePathFromSessionUpdate(
        buildToolCall("Write", "/var/data/claude/plans/x.md"),
      ),
    ).toBe("/var/data/claude/plans/x.md");
    // The dot-prefixed home-dir convention also works when the env var is unset
    delete process.env.CLAUDE_CONFIG_DIR;
    const home = os.homedir();
    expect(
      getPlanFilePathFromSessionUpdate(
        buildToolCall("Write", path.join(home, ".claude", "plans", "x.md")),
      ),
    ).toBe(path.join(home, ".claude", "plans", "x.md"));
  });

  it("ignores tool calls outside the plans directory", () => {
    process.env.CLAUDE_CONFIG_DIR = "/var/data/claude";
    expect(
      getPlanFilePathFromSessionUpdate(
        buildToolCall("Write", "/var/data/claude/cache/foo.md"),
      ),
    ).toBe(null);
    expect(
      getPlanFilePathFromSessionUpdate(
        buildToolCall("Write", "/tmp/random.md"),
      ),
    ).toBe(null);
  });

  it("ignores non-markdown files even inside the plans dir", () => {
    process.env.CLAUDE_CONFIG_DIR = "/var/data/claude";
    expect(
      getPlanFilePathFromSessionUpdate(
        buildToolCall("Write", "/var/data/claude/plans/notes.txt"),
      ),
    ).toBe(null);
  });

  it("ignores read-only tools (Read, Bash, etc.)", () => {
    process.env.CLAUDE_CONFIG_DIR = "/var/data/claude";
    expect(
      getPlanFilePathFromSessionUpdate(
        buildToolCall("Read", "/var/data/claude/plans/x.md"),
      ),
    ).toBe(null);
    expect(
      getPlanFilePathFromSessionUpdate(
        buildToolCall("Bash", "/var/data/claude/plans/x.md"),
      ),
    ).toBe(null);
  });

  it("returns null when there is no rawInput with a file_path", () => {
    expect(
      getPlanFilePathFromSessionUpdate({
        method: "session/update",
        params: { update: { sessionUpdate: "tool_call" } },
      }),
    ).toBe(null);
  });

  it("returns null for unrelated session-update notifications", () => {
    expect(
      getPlanFilePathFromSessionUpdate({
        method: "session/update",
        params: {
          update: {
            sessionUpdate: "agent_message_chunk",
            content: { type: "text", text: "hi" },
          },
        },
      }),
    ).toBe(null);
  });

  it("returns null for non-session/update notifications", () => {
    expect(
      getPlanFilePathFromSessionUpdate({
        method: "session/prompt",
        params: {},
      }),
    ).toBe(null);
  });
});
