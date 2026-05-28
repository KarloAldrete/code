import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { initTRPC, TRPCError } from "@trpc/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { McpToolRegistry } from "./tool-registry";

const t = initTRPC.create();
const procedure = t.procedure;

function makeRouter() {
  return t.router({
    ping: procedure
      .input(z.object({ msg: z.string() }))
      .query(({ input }) => ({ pong: input.msg })),
    settings: t.router({
      read: procedure.query(() => ({ value: "hello" })),
      write: procedure
        .input(z.object({ value: z.string() }))
        .mutation(({ input }) => ({ ok: true as const, value: input.value })),
      writeNumber: procedure
        .input(z.object({ count: z.number().describe("How many") }))
        .mutation(({ input }) => ({ count: input.count })),
    }),
    nonObjectInput: procedure
      .input(z.string())
      .query(({ input }) => ({ input })),
    sub: procedure.subscription(async function* () {
      yield { tick: 1 };
    }),
    failing: procedure.query(() => {
      throw new TRPCError({ code: "FORBIDDEN", message: "not allowed" });
    }),
  });
}

let tmpDir: string;
let yamlPath: string;

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "mcp-tool-registry-"));
  yamlPath = join(tmpDir, "mcp-tools.yaml");
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeYaml(content: string) {
  writeFileSync(yamlPath, content);
}

function makeFakeMcpServer() {
  const registered: Array<{
    name: string;
    config: {
      description?: string;
      inputSchema?: unknown;
      annotations?: unknown;
      title?: string;
    };
    handler: (args: Record<string, unknown>) => Promise<unknown>;
  }> = [];
  return {
    server: {
      registerTool: vi.fn((name, config, handler) => {
        registered.push({ name, config, handler });
      }),
    } as never,
    registered,
  };
}

describe("McpToolRegistry.build", () => {
  it("hard-fails when YAML references a missing procedure", () => {
    writeYaml(`tools:
  bogus:
    operation: not.a.real.path
    enabled: true
    annotations: { readOnly: true, destructive: false, idempotent: true }
`);
    expect(() =>
      McpToolRegistry.build({ router: makeRouter(), yamlPath }),
    ).toThrow(/references operation "not.a.real.path" which does not exist/);
  });

  it("hard-fails when an enabled tool targets a subscription", () => {
    writeYaml(`tools:
  sub:
    operation: sub
    enabled: true
    annotations: { readOnly: true, destructive: false, idempotent: true }
`);
    expect(() =>
      McpToolRegistry.build({ router: makeRouter(), yamlPath }),
    ).toThrow(/subscription procedure/);
  });

  it("hard-fails when an enabled tool's input is not a ZodObject", () => {
    writeYaml(`tools:
  nonObjectInput:
    operation: nonObjectInput
    enabled: true
    annotations: { readOnly: true, destructive: false, idempotent: true }
`);
    expect(() =>
      McpToolRegistry.build({ router: makeRouter(), yamlPath }),
    ).toThrow(/not a z.object/);
  });

  it("hard-fails when YAML lacks annotations on enabled tool", () => {
    writeYaml(`tools:
  ping:
    operation: ping
    enabled: true
`);
    expect(() =>
      McpToolRegistry.build({ router: makeRouter(), yamlPath }),
    ).toThrow(/enabled tools must declare annotations/);
  });

  it("hard-fails when param_overrides reference an unknown field", () => {
    writeYaml(`tools:
  ping:
    operation: ping
    enabled: true
    annotations: { readOnly: true, destructive: false, idempotent: true }
    param_overrides:
      missing:
        description: x
`);
    expect(() =>
      McpToolRegistry.build({ router: makeRouter(), yamlPath }),
    ).toThrow(/overrides param "missing"/);
  });

  it("hard-fails when exclude_params reference an unknown field", () => {
    writeYaml(`tools:
  ping:
    operation: ping
    enabled: true
    annotations: { readOnly: true, destructive: false, idempotent: true }
    exclude_params: ["missing"]
`);
    expect(() =>
      McpToolRegistry.build({ router: makeRouter(), yamlPath }),
    ).toThrow(/excludes param "missing"/);
  });

  it("skips disabled tools even if their procedure is broken", () => {
    writeYaml(`tools:
  sub:
    operation: sub
    enabled: false
  ping:
    operation: ping
    enabled: false
`);
    const reg = McpToolRegistry.build({ router: makeRouter(), yamlPath });
    expect(reg.getEntries()).toHaveLength(0);
  });
});

describe("McpToolRegistry.registerAll", () => {
  it("registers an enabled query with description and annotations", async () => {
    writeYaml(`tools:
  ping:
    operation: ping
    enabled: true
    title: Ping
    description: Echoes the message back.
    annotations:
      readOnly: true
      destructive: false
      idempotent: true
`);
    const router = makeRouter();
    const reg = McpToolRegistry.build({ router, yamlPath });
    const { server, registered } = makeFakeMcpServer();

    reg.registerAll(server, router);

    expect(registered).toHaveLength(1);
    expect(registered[0].name).toBe("ping");
    expect(registered[0].config.title).toBe("Ping");
    expect(registered[0].config.description).toContain("Echoes");
    expect(registered[0].config.annotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    });

    const result = (await registered[0].handler({ msg: "hi" })) as {
      content: Array<{ text: string }>;
    };
    expect(result.content[0].text).toContain('"pong"');
    expect(result.content[0].text).toContain('"hi"');
  });

  it("invokes the underlying procedure via createCaller", async () => {
    writeYaml(`tools:
  settings.write:
    operation: settings.write
    enabled: true
    annotations: { readOnly: false, destructive: true, idempotent: false }
`);
    const router = makeRouter();
    const reg = McpToolRegistry.build({ router, yamlPath });
    const { server, registered } = makeFakeMcpServer();
    reg.registerAll(server, router);

    const result = (await registered[0].handler({
      value: "foo",
    })) as { content: Array<{ text: string }> };
    expect(result.content[0].text).toContain('"ok": true');
    expect(result.content[0].text).toContain('"value": "foo"');
  });

  it("formats TRPCError as MCP isError", async () => {
    writeYaml(`tools:
  failing:
    operation: failing
    enabled: true
    annotations: { readOnly: true, destructive: false, idempotent: true }
`);
    const router = makeRouter();
    const reg = McpToolRegistry.build({ router, yamlPath });
    const { server, registered } = makeFakeMcpServer();
    reg.registerAll(server, router);

    const result = (await registered[0].handler({})) as {
      isError: boolean;
      content: Array<{ text: string }>;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("FORBIDDEN");
    expect(result.content[0].text).toContain("not allowed");
  });

  it("formats Zod validation failures as MCP isError", async () => {
    writeYaml(`tools:
  ping:
    operation: ping
    enabled: true
    annotations: { readOnly: true, destructive: false, idempotent: true }
`);
    const router = makeRouter();
    const reg = McpToolRegistry.build({ router, yamlPath });
    const { server, registered } = makeFakeMcpServer();
    reg.registerAll(server, router);

    // msg is required; pass nothing and let tRPC's Zod parse reject it.
    const result = (await registered[0].handler({})) as {
      isError: boolean;
      content: Array<{ text: string }>;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0].text.toLowerCase()).toMatch(
      /msg|required|invalid/,
    );
  });

  it("applies param_overrides descriptions to inputSchema shape", async () => {
    writeYaml(`tools:
  settings.writeNumber:
    operation: settings.writeNumber
    enabled: true
    annotations: { readOnly: false, destructive: false, idempotent: false }
    param_overrides:
      count:
        description: Overridden description for count
`);
    const router = makeRouter();
    const reg = McpToolRegistry.build({ router, yamlPath });
    const { server, registered } = makeFakeMcpServer();
    reg.registerAll(server, router);

    const shape = (
      registered[0].config.inputSchema as Record<string, z.ZodTypeAny>
    ).count;
    expect(shape.description).toBe("Overridden description for count");
  });

  it("rename_params remaps the MCP-facing key but calls procedure with original", async () => {
    writeYaml(`tools:
  ping:
    operation: ping
    enabled: true
    annotations: { readOnly: true, destructive: false, idempotent: true }
    rename_params:
      msg: message
`);
    const router = makeRouter();
    const reg = McpToolRegistry.build({ router, yamlPath });
    const { server, registered } = makeFakeMcpServer();
    reg.registerAll(server, router);

    const shape = registered[0].config.inputSchema as Record<string, unknown>;
    expect(Object.keys(shape)).toEqual(["message"]);

    const result = (await registered[0].handler({
      message: "renamed",
    })) as { content: Array<{ text: string }> };
    expect(result.content[0].text).toContain("renamed");
  });

  it("exclude_params omits keys from the exposed inputSchema", async () => {
    writeYaml(`tools:
  ping:
    operation: ping
    enabled: true
    annotations: { readOnly: true, destructive: false, idempotent: true }
    exclude_params: ["msg"]
`);
    const router = makeRouter();
    const reg = McpToolRegistry.build({ router, yamlPath });
    const { server, registered } = makeFakeMcpServer();
    reg.registerAll(server, router);

    const shape = registered[0].config.inputSchema as Record<string, unknown>;
    expect(Object.keys(shape)).toEqual([]);
  });

  it("loads description from a sibling description_file", async () => {
    const descPath = join(tmpDir, "ping-desc.txt");
    writeFileSync(descPath, "  Description from file  \n");
    writeYaml(`tools:
  ping:
    operation: ping
    enabled: true
    description_file: ping-desc.txt
    annotations: { readOnly: true, destructive: false, idempotent: true }
`);
    const router = makeRouter();
    const reg = McpToolRegistry.build({ router, yamlPath });
    const { server, registered } = makeFakeMcpServer();
    reg.registerAll(server, router);

    expect(registered[0].config.description).toBe("Description from file");
  });
});
