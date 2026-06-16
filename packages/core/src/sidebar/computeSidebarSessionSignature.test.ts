import { describe, expect, it } from "vitest";
import { computeSidebarSessionSignature } from "./buildSidebarData";

// Minimal session shape the signature reads. `events` is included to prove it
// is ignored (the streaming hot path only mutates `events`).
function session(over: Record<string, unknown> = {}) {
  return {
    taskId: "t1",
    isPromptPending: false,
    pendingPermissions: new Map(),
    cloudStatus: undefined,
    cloudOutput: null,
    events: [],
    ...over,
  } as never;
}

describe("computeSidebarSessionSignature", () => {
  it("ignores events, so streaming tokens don't change it", () => {
    const few = computeSidebarSessionSignature({
      r1: session({ events: [1, 2] }),
    });
    const many = computeSidebarSessionSignature({
      r1: session({ events: [1, 2, 3, 4, 5, 6, 7] }),
    });
    expect(many).toBe(few);
  });

  it.each([
    { label: "isPromptPending", over: { isPromptPending: true } },
    { label: "cloudStatus", over: { cloudStatus: "in_progress" } },
    {
      label: "pendingPermissions size",
      over: { pendingPermissions: new Map([["p", {}]]) },
    },
    {
      label: "cloudOutput.pr_url",
      over: { cloudOutput: { pr_url: "https://x/pr/1" } },
    },
  ])("changes when $label changes", ({ over }) => {
    const before = computeSidebarSessionSignature({ r1: session() });
    expect(computeSidebarSessionSignature({ r1: session(over) })).not.toBe(
      before,
    );
  });

  it("skips sessions without a taskId", () => {
    expect(
      computeSidebarSessionSignature({ r1: session({ taskId: "" }) }),
    ).toBe("");
  });
});
