import * as fs from "node:fs";
import * as path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AnyProcedure, AnyRouter } from "@trpc/server";
import { TRPCError } from "@trpc/server";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { logger } from "../../utils/logger";
import { McpToolsYamlSchema, type ToolConfig } from "./yaml-schema";

const log = logger.scope("mcp-tool-registry");

interface ProcedureEntry {
  path: string;
  type: "query" | "mutation" | "subscription";
  inputSchema: z.ZodTypeAny | undefined;
}

interface RegisteredEntry {
  toolName: string;
  config: Required<Pick<ToolConfig, "operation" | "enabled" | "annotations">> &
    ToolConfig;
  procedure: ProcedureEntry;
  /** Final Zod object after applying exclude_params + param_overrides. */
  inputSchema: z.ZodObject<z.ZodRawShape> | null;
  /** Inverse map of rename_params: MCP-side key → tRPC-side key. */
  renameInverse: Record<string, string>;
}

/**
 * Generic bridge from tRPC procedures to MCP tools, driven by `mcp-tools.yaml`.
 *
 * Design constraints:
 * - Default-deny: every procedure must be explicitly enabled in YAML.
 * - Hard-fail at boot on any mismatch (missing procedure, malformed config,
 *   non-ZodObject input on an enabled tool, etc.) — silent drift is worse
 *   than a startup crash that names exactly what to fix.
 * - Context-free: procedures are invoked via `router.createCaller({})`, so
 *   they must resolve their dependencies via the main-process DI container
 *   rather than tRPC context. True today for every router under
 *   `apps/code/src/main/trpc/routers/` — if that ever changes, this registry
 *   must thread a real ctx.
 */
export class McpToolRegistry {
  constructor(private readonly entries: RegisteredEntry[]) {}

  static build({
    router,
    yamlPath,
  }: {
    router: AnyRouter;
    yamlPath: string;
  }): McpToolRegistry {
    if (!fs.existsSync(yamlPath)) {
      throw new Error(`mcp-tools.yaml not found at ${yamlPath}`);
    }
    const raw = fs.readFileSync(yamlPath, "utf-8");
    const parsed = parseYaml(raw);
    const validated = McpToolsYamlSchema.safeParse(parsed);
    if (!validated.success) {
      const issues = validated.error.issues
        .map((i) => `  ${i.path.join(".")}: ${i.message}`)
        .join("\n");
      throw new Error(`Invalid mcp-tools.yaml:\n${issues}`);
    }

    const procedures = collectProcedures(router);
    const proceduresByPath = new Map(procedures.map((p) => [p.path, p]));
    const yamlDir = path.dirname(yamlPath);

    const entries: RegisteredEntry[] = [];
    for (const [toolName, config] of Object.entries(validated.data.tools)) {
      const procedure = proceduresByPath.get(config.operation);
      if (!procedure) {
        throw new Error(
          `mcp-tools.yaml: tool "${toolName}" references operation "${config.operation}" which does not exist on the tRPC router. ` +
            `Run \`pnpm --filter code scaffold-mcp-tools\` to sync.`,
        );
      }
      if (!config.enabled) continue;

      if (procedure.type === "subscription") {
        throw new Error(
          `mcp-tools.yaml: tool "${toolName}" targets subscription procedure "${procedure.path}". ` +
            `Subscriptions cannot be exposed as MCP tools — set enabled: false.`,
        );
      }

      const { inputSchema, renameInverse } = composeInputSchema({
        toolName,
        procedure,
        config,
      });

      const resolvedDescription = resolveDescription(config, yamlDir);
      // refinements above guarantee annotations is present when enabled, but
      // narrow defensively rather than asserting.
      const annotations = config.annotations;
      if (!annotations) {
        throw new Error(
          `mcp-tools.yaml: tool "${toolName}" is enabled but missing annotations.`,
        );
      }

      entries.push({
        toolName,
        config: {
          ...config,
          annotations,
          description: resolvedDescription,
        },
        procedure,
        inputSchema,
        renameInverse,
      });
    }

    log.info("MCP tool registry built", {
      enabled: entries.length,
      total: Object.keys(validated.data.tools).length,
      proceduresInRouter: procedures.length,
    });

    return new McpToolRegistry(entries);
  }

  /** Register every enabled tool with the given MCP server instance. */
  registerAll(server: McpServer, router: AnyRouter): void {
    for (const entry of this.entries) {
      this.registerOne(server, router, entry);
    }
  }

  /** Useful for tests. */
  getEntries(): readonly RegisteredEntry[] {
    return this.entries;
  }

  private registerOne(
    server: McpServer,
    router: AnyRouter,
    entry: RegisteredEntry,
  ): void {
    const handler = async (
      args: Record<string, unknown>,
    ): Promise<CallToolResult> => {
      try {
        const renamed = renameArgs(args, entry.renameInverse);
        const caller = (
          router as unknown as {
            createCaller: (ctx: unknown) => Record<string, unknown>;
          }
        ).createCaller({});
        const procedureFn = resolveCallerPath(caller, entry.procedure.path);
        const result = await procedureFn(renamed);
        return {
          content: [{ type: "text", text: safeStringify(result) }],
        };
      } catch (err) {
        return formatError(err);
      }
    };

    const annotations = mapAnnotations(entry.config.annotations);

    if (entry.inputSchema) {
      server.registerTool(
        entry.toolName,
        {
          title: entry.config.title,
          description: entry.config.description ?? entry.toolName,
          inputSchema: entry.inputSchema.shape,
          annotations,
        },
        handler as never,
      );
    } else {
      server.registerTool(
        entry.toolName,
        {
          title: entry.config.title,
          description: entry.config.description ?? entry.toolName,
          annotations,
        },
        handler as never,
      );
    }
  }
}

function collectProcedures(router: AnyRouter): ProcedureEntry[] {
  const record = router._def.procedures as Record<string, AnyProcedure>;
  const out: ProcedureEntry[] = [];
  for (const [path, procedure] of Object.entries(record)) {
    const inputs = (procedure._def.inputs ?? []) as unknown[];
    const inputSchema =
      inputs.length > 0 ? (inputs[0] as z.ZodTypeAny) : undefined;
    out.push({
      path,
      type: procedure._def.type,
      inputSchema,
    });
  }
  return out;
}

function composeInputSchema({
  toolName,
  procedure,
  config,
}: {
  toolName: string;
  procedure: ProcedureEntry;
  config: ToolConfig;
}): {
  inputSchema: z.ZodObject<z.ZodRawShape> | null;
  renameInverse: Record<string, string>;
} {
  const renameInverse: Record<string, string> = {};
  if (config.rename_params) {
    for (const [orig, alias] of Object.entries(config.rename_params)) {
      renameInverse[alias] = orig;
    }
  }

  if (!procedure.inputSchema) {
    if (
      config.param_overrides ||
      config.exclude_params ||
      config.rename_params
    ) {
      throw new Error(
        `mcp-tools.yaml: tool "${toolName}" specifies param overrides/excludes/renames but procedure "${procedure.path}" has no input.`,
      );
    }
    return { inputSchema: null, renameInverse };
  }

  const baseSchema = procedure.inputSchema;
  if (!(baseSchema instanceof z.ZodObject)) {
    throw new Error(
      `mcp-tools.yaml: tool "${toolName}" targets procedure "${procedure.path}" whose input is not a z.object — cannot expand into MCP params.`,
    );
  }
  let schema: z.ZodObject<z.ZodRawShape> =
    baseSchema as z.ZodObject<z.ZodRawShape>;

  if (config.exclude_params) {
    for (const key of config.exclude_params) {
      if (!(key in schema.shape)) {
        throw new Error(
          `mcp-tools.yaml: tool "${toolName}" excludes param "${key}" not present on procedure "${procedure.path}".`,
        );
      }
    }
    const omitShape: Record<string, true> = {};
    for (const key of config.exclude_params) omitShape[key] = true;
    schema = schema.omit(omitShape as never) as z.ZodObject<z.ZodRawShape>;
  }

  if (config.param_overrides) {
    const nextShape: Record<string, z.ZodTypeAny> = {
      ...(schema.shape as Record<string, z.ZodTypeAny>),
    };
    for (const [key, override] of Object.entries(config.param_overrides)) {
      if (!(key in nextShape)) {
        throw new Error(
          `mcp-tools.yaml: tool "${toolName}" overrides param "${key}" not present on procedure "${procedure.path}".`,
        );
      }
      if (override.description !== undefined) {
        nextShape[key] = nextShape[key].describe(override.description);
      }
    }
    schema = z.object(nextShape);
  }

  if (config.rename_params) {
    const nextShape: Record<string, z.ZodTypeAny> = {};
    for (const [origKey, field] of Object.entries(schema.shape)) {
      const alias = config.rename_params[origKey] ?? origKey;
      if (alias in nextShape) {
        throw new Error(
          `mcp-tools.yaml: tool "${toolName}" rename collision — "${alias}" appears twice in the renamed shape.`,
        );
      }
      nextShape[alias] = field as z.ZodTypeAny;
    }
    schema = z.object(nextShape);
  }

  return { inputSchema: schema, renameInverse };
}

function resolveDescription(
  config: ToolConfig,
  yamlDir: string,
): string | undefined {
  if (config.description) return config.description;
  if (config.description_file) {
    const filePath = path.resolve(yamlDir, config.description_file);
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `mcp-tools.yaml: description_file "${config.description_file}" not found (resolved to ${filePath}).`,
      );
    }
    return fs.readFileSync(filePath, "utf-8").trim();
  }
  return undefined;
}

function renameArgs(
  args: Record<string, unknown> | undefined,
  inverse: Record<string, string>,
): Record<string, unknown> | undefined {
  if (!args) return args;
  if (Object.keys(inverse).length === 0) return args;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    out[inverse[key] ?? key] = value;
  }
  return out;
}

function resolveCallerPath(
  caller: Record<string, unknown>,
  procedurePath: string,
): (input: unknown) => Promise<unknown> {
  const parts = procedurePath.split(".");
  let current: unknown = caller;
  for (const part of parts) {
    if (current === undefined || current === null) {
      throw new Error(`Cannot resolve "${procedurePath}" on caller`);
    }
    current = (current as Record<string, unknown>)[part];
  }
  if (typeof current !== "function") {
    throw new Error(`"${procedurePath}" did not resolve to a procedure`);
  }
  return current as (input: unknown) => Promise<unknown>;
}

function safeStringify(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatError(err: unknown): CallToolResult {
  if (err instanceof TRPCError) {
    return {
      isError: true,
      content: [{ type: "text", text: `[${err.code}] ${err.message}` }],
    };
  }
  if (err instanceof z.ZodError) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Invalid input:\n${err.issues
            .map((i) => `  ${i.path.join(".")}: ${i.message}`)
            .join("\n")}`,
        },
      ],
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

function mapAnnotations(annotations: NonNullable<ToolConfig["annotations"]>): {
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
} {
  return {
    readOnlyHint: annotations.readOnly,
    destructiveHint: annotations.destructive,
    idempotentHint: annotations.idempotent,
  };
}
