#!/usr/bin/env tsx
/**
 * Sync `apps/code/src/main/services/posthog-code-internal-mcp/mcp-tools.yaml`
 * with the live tRPC router.
 *
 * - Walks the router via `_def.procedures` and emits an `enabled: false` stub
 *   for every procedure that isn't already in the YAML.
 * - Leaves existing entries untouched — your hand-authored config (title,
 *   description, annotations, param_overrides) is preserved.
 * - Does NOT remove entries whose procedure has disappeared. It prints them
 *   as warnings; you decide whether to delete. Boot will hard-fail until you
 *   do, which is the forcing function.
 *
 * Usage:
 *   pnpm --filter code scaffold-mcp-tools
 *   pnpm --filter code scaffold-mcp-tools --check    # exit 1 if out of date
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// Imports below transitively load main-process services that read env vars
// at module-load time (see apps/code/src/main/utils/env.ts). Set defaults
// here so the script works outside an Electron context. Done before any
// dynamic import below.
if (!process.env.POSTHOG_CODE_DATA_DIR) {
  process.env.POSTHOG_CODE_DATA_DIR = path.join(
    os.tmpdir(),
    "posthog-code-scaffold-mcp-tools",
  );
}
if (!process.env.POSTHOG_CODE_IS_DEV) process.env.POSTHOG_CODE_IS_DEV = "true";
if (!process.env.POSTHOG_CODE_VERSION) {
  process.env.POSTHOG_CODE_VERSION = "0.0.0-scaffold";
}

const YAML_PATH = path.resolve(
  __dirname,
  "..",
  "src",
  "main",
  "services",
  "posthog-code-internal-mcp",
  "mcp-tools.yaml",
);

const YAML_HEADER = `# Bridge from tRPC procedures to MCP tools exposed to the running agent.
#
# Re-run \`pnpm --filter code scaffold-mcp-tools\` after adding or removing
# tRPC procedures. New entries are scaffolded as enabled: false; the boot-time
# registry hard-fails if an entry references a procedure that no longer
# exists, so stale entries must be deleted by hand.
#
# Default-deny: every enabled tool is callable by the agent. Review carefully
# before flipping enabled: true on anything beyond the curated defaults.
`;

interface Procedure {
  path: string;
  type: "query" | "mutation" | "subscription";
}

async function main(): Promise<void> {
  const check = process.argv.includes("--check");

  // Dynamic import so the env defaults above are in place before the router's
  // transitive deps load.
  const { trpcRouter } = await import("../src/main/trpc/router");
  const { McpToolsYamlSchema } = await import(
    "../src/main/services/posthog-code-internal-mcp/yaml-schema"
  );
  const { parse: parseYaml, stringify: stringifyYaml } = await import("yaml");

  const record = trpcRouter._def.procedures as Record<
    string,
    { _def: { type: "query" | "mutation" | "subscription" } }
  >;
  const procedures: Procedure[] = Object.entries(record)
    .map(([p, proc]) => ({ path: p, type: proc._def.type }))
    .filter((p) => p.type !== "subscription");

  let existing: { tools: Record<string, { operation: string }> } = {
    tools: {},
  };
  if (fs.existsSync(YAML_PATH)) {
    const raw = fs.readFileSync(YAML_PATH, "utf-8");
    const parsed = parseYaml(raw);
    const result = McpToolsYamlSchema.safeParse(parsed);
    if (!result.success) {
      console.error("Invalid existing mcp-tools.yaml:");
      for (const issue of result.error.issues) {
        console.error(`  ${issue.path.join(".")}: ${issue.message}`);
      }
      process.exit(1);
    }
    existing = result.data as { tools: Record<string, { operation: string }> };
  }

  const proceduresByPath = new Map(procedures.map((p) => [p.path, p]));
  const existingByOperation = new Map<string, [string, unknown]>();
  for (const [name, config] of Object.entries(existing.tools)) {
    existingByOperation.set(config.operation, [name, config]);
  }

  const mergedTools: Record<string, unknown> = {};
  let added = 0;
  let unchanged = 0;
  const stale: string[] = [];

  for (const proc of procedures) {
    const existingEntry = existingByOperation.get(proc.path);
    if (existingEntry) {
      const [name, config] = existingEntry;
      mergedTools[name] = config;
      unchanged++;
    } else {
      mergedTools[proc.path] = {
        operation: proc.path,
        enabled: false,
      };
      added++;
    }
  }

  for (const [name, config] of Object.entries(existing.tools)) {
    if (!proceduresByPath.has(config.operation)) {
      mergedTools[name] = config;
      stale.push(`${name} → ${config.operation}`);
    }
  }

  const sortedTools = Object.fromEntries(
    Object.entries(mergedTools).sort(([a], [b]) => a.localeCompare(b)),
  );

  const nextContent =
    YAML_HEADER + stringifyYaml({ tools: sortedTools }, { lineWidth: 120 });
  const currentContent = fs.existsSync(YAML_PATH)
    ? fs.readFileSync(YAML_PATH, "utf-8")
    : "";

  const isUpToDate = currentContent === nextContent;

  if (check) {
    if (!isUpToDate) {
      console.error(
        "mcp-tools.yaml is out of date with the tRPC router. Run `pnpm --filter code scaffold-mcp-tools` and commit the result.",
      );
      console.error(
        `  unchanged=${unchanged} added=${added} stale=${stale.length}`,
      );
      process.exit(1);
    }
    console.log(
      `mcp-tools.yaml is up to date (${procedures.length} procedures).`,
    );
    return;
  }

  if (!isUpToDate) {
    fs.writeFileSync(YAML_PATH, nextContent);
  }

  console.log(
    `mcp-tools.yaml: ${procedures.length} procedures total — ${unchanged} unchanged, ${added} added.`,
  );
  if (stale.length > 0) {
    console.warn(
      `\n⚠ ${stale.length} stale tool(s) in YAML reference procedures that no longer exist:`,
    );
    for (const s of stale) console.warn(`  - ${s}`);
    console.warn(
      "  These were left in place. Delete them or boot will hard-fail.",
    );
    process.exitCode = 2;
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
