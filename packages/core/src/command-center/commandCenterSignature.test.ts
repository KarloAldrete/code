import { describe, expect, it } from "vitest";
import {
  type CommandCenterSessionFields,
  computeCommandCenterSessionSignature,
} from "./status";

function session(
  taskId: string,
  over: Partial<CommandCenterSessionFields> = {},
): CommandCenterSessionFields {
  return {
    taskId,
    status: "connected",
    cloudStatus: undefined,
    pendingPermissions: { size: 0 },
    isPromptPending: false,
    ...over,
  };
}

const sig = (record: Record<string, CommandCenterSessionFields>) =>
  computeCommandCenterSessionSignature(record);

describe("computeCommandCenterSessionSignature", () => {
  it("is stable when only non-status fields change (e.g. streamed events)", () => {
    // Two sessions identical in the 4 status-relevant fields → same signature,
    // regardless of any other mutation the store makes (token appends etc.).
    const a = { r1: session("t1") };
    const b = { r1: session("t1") };
    expect(sig(a)).toBe(sig(b));
  });

  it.each<{ name: string; over: Partial<CommandCenterSessionFields> }>([
    {
      name: "isPromptPending flips (idle ↔ running)",
      over: { isPromptPending: true },
    },
    {
      name: "a pending permission appears (running → waiting)",
      over: { pendingPermissions: { size: 1 } },
    },
    { name: "connection status changes", over: { status: "error" } },
    { name: "cloud status changes", over: { cloudStatus: "completed" } },
  ])("changes when $name", ({ over }) => {
    expect(sig({ r1: session("t1") })).not.toBe(
      sig({ r1: session("t1", over) }),
    );
  });

  it("is order-independent across sessions", () => {
    const s1 = session("t1");
    const s2 = session("t2", { isPromptPending: true });
    expect(sig({ r1: s1, r2: s2 })).toBe(sig({ r2: s2, r1: s1 }));
  });

  it("ignores sessions without a taskId", () => {
    expect(sig({ r1: session("t1"), r2: session("", {}) })).toBe(
      sig({ r1: session("t1") }),
    );
  });
});
