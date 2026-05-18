import type { InjectPromptEventPayload } from "@main/services/hedgemony/schemas";
import { describe, expect, it } from "vitest";
import { resolveHedgemonyPromptRoute } from "./promptRouting";

function makePayload(
  overrides: Partial<InjectPromptEventPayload> = {},
): InjectPromptEventPayload {
  return {
    taskId: "task-1",
    hogletId: "hoglet-1",
    nestId: "nest-1",
    source: "hedgehog",
    targetRunStatus: "in_progress",
    payloadRef: "hedgehog-message:nest-1:tool-1",
    payloadHash: "hash",
    prompt: "Status?",
    prUrl: "",
    fallbackPrompt: "Status?",
    ...overrides,
  };
}

describe("resolveHedgemonyPromptRoute", () => {
  it("injects when the session is connected", () => {
    expect(
      resolveHedgemonyPromptRoute({
        payload: makePayload(),
        sessionStatus: "connected",
        latestRunStatus: "in_progress",
      }),
    ).toBe("inject");
  });

  it("suppresses hedgehog follow-up spawning for active detached runs", () => {
    expect(
      resolveHedgemonyPromptRoute({
        payload: makePayload({ targetRunStatus: "in_progress" }),
        sessionStatus: "disconnected",
        latestRunStatus: null,
      }),
    ).toBe("suppress_hedgehog_follow_up");
  });

  it("uses task summary status when the event has no target status", () => {
    expect(
      resolveHedgemonyPromptRoute({
        payload: makePayload({ targetRunStatus: null }),
        sessionStatus: "disconnected",
        latestRunStatus: "queued",
      }),
    ).toBe("suppress_hedgehog_follow_up");
  });

  it("still spawns follow-ups for external feedback", () => {
    expect(
      resolveHedgemonyPromptRoute({
        payload: makePayload({
          source: "pr_review",
          targetRunStatus: "in_progress",
          prUrl: "https://github.com/org/repo/pull/1",
        }),
        sessionStatus: "disconnected",
        latestRunStatus: "in_progress",
      }),
    ).toBe("spawn_follow_up");
  });
});
