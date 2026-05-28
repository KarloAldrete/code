#!/usr/bin/env tsx
/**
 * Sync `apps/code/src/main/services/posthog-code-internal-mcp/mcp-tools.yaml`
 * with the live tRPC router.
 *
 * Uses the TypeScript compiler API to STATICALLY parse the router and
 * sub-router source files — no runtime import, no Electron, no Node ESM/CJS
 * interop. Walks `router({ ... })` object literals, detects whether each
 * procedure chain ends in `.query`, `.mutation`, or `.subscription`, and
 * emits `enabled: false` stubs for procedures missing from the YAML.
 *
 * Usage:
 *   pnpm --filter code scaffold-mcp-tools
 *   pnpm --filter code scaffold-mcp-tools --check    # exit 1 if out of date
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { McpToolsYamlSchema } from "../src/main/services/posthog-code-internal-mcp/yaml-schema";

const APP_ROOT = path.resolve(__dirname, "..");
const ROUTER_FILE = path.join(APP_ROOT, "src/main/trpc/router.ts");
const ROUTERS_DIR = path.join(APP_ROOT, "src/main/trpc/routers");
const YAML_PATH = path.join(
  APP_ROOT,
  "src/main/services/posthog-code-internal-mcp/mcp-tools.yaml",
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

type ProcedureType = "query" | "mutation" | "subscription";

interface Procedure {
  path: string;
  type: ProcedureType;
}

function parseSource(filePath: string): ts.SourceFile {
  const text = fs.readFileSync(filePath, "utf-8");
  return ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
}

/**
 * Find the object literal passed to a `router({...})` call inside the
 * given source file. We look for the FIRST top-level `router(...)` call
 * expression; that's the canonical pattern in this codebase (one router
 * declaration per file).
 */
function findRouterObjectLiteral(
  source: ts.SourceFile,
): ts.ObjectLiteralExpression | undefined {
  let result: ts.ObjectLiteralExpression | undefined;

  function visit(node: ts.Node): void {
    if (result) return;
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "router" &&
      node.arguments.length === 1 &&
      ts.isObjectLiteralExpression(node.arguments[0])
    ) {
      result = node.arguments[0];
      return;
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return result;
}

/**
 * Build a map of namespace → router-file-basename by parsing the root
 * router.ts. The pattern is:
 *
 *   import { fooRouter } from "./routers/foo";
 *   export const trpcRouter = router({ foo: fooRouter, ... });
 *
 * We use the property assignments to map namespace → identifier, then the
 * import declarations to map identifier → file path.
 */
function discoverSubRouters(): Map<string, string> {
  const source = parseSource(ROUTER_FILE);

  const importMap = new Map<string, string>();
  for (const stmt of source.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    const moduleSpec = stmt.moduleSpecifier.text;
    if (!moduleSpec.startsWith("./routers/")) continue;
    const basename = moduleSpec.slice("./routers/".length).replace(/\.js$/, "");
    const fileAbs = path.join(ROUTERS_DIR, `${basename}.ts`);
    if (!stmt.importClause?.namedBindings) continue;
    if (!ts.isNamedImports(stmt.importClause.namedBindings)) continue;
    for (const spec of stmt.importClause.namedBindings.elements) {
      importMap.set(spec.name.text, fileAbs);
    }
  }

  const literal = findRouterObjectLiteral(source);
  if (!literal) {
    throw new Error(`Could not find router({...}) call in ${ROUTER_FILE}`);
  }

  const namespaces = new Map<string, string>();
  for (const prop of literal.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = propertyName(prop.name);
    if (!key) continue;
    if (!ts.isIdentifier(prop.initializer)) continue;
    const filePath = importMap.get(prop.initializer.text);
    if (!filePath) {
      throw new Error(
        `Router namespace '${key}' maps to identifier '${prop.initializer.text}' which has no matching import in router.ts`,
      );
    }
    namespaces.set(key, filePath);
  }

  return namespaces;
}

function propertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return undefined;
}

/**
 * Walk the procedure chain's outermost call to determine its type. The chain
 * looks like:
 *   publicProcedure.input(X).output(Y).query(handler)
 *   publicProcedure.subscription(handler)
 * The OUTERMOST call's property name tells us the type. Anything that
 * doesn't end in query/mutation/subscription is skipped (e.g. helpers).
 */
function classifyProcedure(expr: ts.Expression): ProcedureType | undefined {
  if (!ts.isCallExpression(expr)) return undefined;
  const callee = expr.expression;
  if (!ts.isPropertyAccessExpression(callee)) return undefined;
  const method = callee.name.text;
  if (
    method === "query" ||
    method === "mutation" ||
    method === "subscription"
  ) {
    return method;
  }
  return undefined;
}

function parseRouterProcedures(
  namespace: string,
  filePath: string,
): Procedure[] {
  const source = parseSource(filePath);
  const literal = findRouterObjectLiteral(source);
  if (!literal) {
    throw new Error(`Could not find router({...}) call in ${filePath}`);
  }
  const procedures: Procedure[] = [];
  for (const prop of literal.properties) {
    if (!ts.isPropertyAssignment(prop)) continue;
    const key = propertyName(prop.name);
    if (!key) continue;
    const type = classifyProcedure(prop.initializer);
    if (!type) continue;
    procedures.push({ path: `${namespace}.${key}`, type });
  }
  return procedures;
}

function discoverProcedures(): Procedure[] {
  const namespaces = discoverSubRouters();
  const all: Procedure[] = [];
  for (const [namespace, filePath] of namespaces) {
    all.push(...parseRouterProcedures(namespace, filePath));
  }
  return all.filter((p) => p.type !== "subscription");
}

function main(): void {
  const check = process.argv.includes("--check");
  const procedures = discoverProcedures();

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

main();
