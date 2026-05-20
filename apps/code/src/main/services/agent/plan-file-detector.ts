import os from "node:os";
import path from "node:path";
import { z } from "zod";

/**
 * Mirrors `getClaudePlansDir()` in @posthog/agent. Kept local so the main
 * process never has to depend on the agent package for this single helper
 * (and so we don't add a new subpath export).
 */
function getClaudePlansDir(): string {
  const configDir =
    process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  return path.join(configDir, "plans");
}

const WRITE_TOOL_NAMES = new Set(["Write", "Edit", "MultiEdit"]);

const ToolInputWithFilePath = z
  .object({ file_path: z.string().min(1) })
  .passthrough();

const SessionUpdateNotification = z.object({
  method: z.literal("session/update"),
  params: z
    .object({
      update: z
        .object({
          sessionUpdate: z.string(),
          rawInput: z.unknown().optional(),
          _meta: z
            .object({
              claudeCode: z
                .object({ toolName: z.string().optional() })
                .passthrough()
                .optional(),
            })
            .passthrough()
            .optional(),
        })
        .passthrough(),
    })
    .passthrough(),
});

function isPlanFilePath(filePath: string): boolean {
  if (!filePath.endsWith(".md")) return false;
  const resolved = path.resolve(filePath);
  const plansDir = path.resolve(getClaudePlansDir());
  return resolved.startsWith(plansDir + path.sep);
}

/**
 * Inspects a raw JSON-RPC message coming from the agent SDK and returns the
 * plan file path if it represents a Write/Edit tool call targeting the
 * configured `~/.claude/plans/` directory.
 *
 * This is the *single source of truth* for plan-file detection across the
 * app: it uses the same env var (`CLAUDE_CONFIG_DIR`) that `env.ts` sets at
 * boot, so the detection matches the directory the watcher actually
 * watches.
 *
 * Validation note: per repo guidance we don't trust `rawInput` for stable
 * contracts — we validate the small subset we care about with Zod at this
 * boundary so callers receive a typed `string | null`.
 */
export function getPlanFilePathFromSessionUpdate(
  message: unknown,
): string | null {
  const parsed = SessionUpdateNotification.safeParse(message);
  if (!parsed.success) return null;

  const update = parsed.data.params.update;
  if (
    update.sessionUpdate !== "tool_call" &&
    update.sessionUpdate !== "tool_call_update"
  ) {
    return null;
  }

  const toolName = update._meta?.claudeCode?.toolName;
  if (!toolName || !WRITE_TOOL_NAMES.has(toolName)) return null;

  const inputParse = ToolInputWithFilePath.safeParse(update.rawInput);
  if (!inputParse.success) return null;

  const filePath = inputParse.data.file_path;
  return isPlanFilePath(filePath) ? filePath : null;
}
