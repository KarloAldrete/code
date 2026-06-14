import type { ContentBlock } from "@agentclientprotocol/sdk";
import type { PendingPromptRecord } from "@posthog/core/sessions/pendingPrompt";
import { beforeEach, describe, expect, it } from "vitest";
import {
  pendingPromptStore,
  usePendingPromptStore,
} from "./pendingPromptStore";

function record(
  taskId: string,
  text: string,
  overrides: Partial<PendingPromptRecord> = {},
): PendingPromptRecord {
  const initialPrompt: ContentBlock[] = [{ type: "text", text }];
  return {
    taskId,
    taskTitle: `Task ${taskId}`,
    repoPath: "/repo",
    initialPrompt,
    createdAt: 1,
    ...overrides,
  };
}

function storedTaskIds(): string[] {
  return Object.keys(usePendingPromptStore.getState().promptsByTaskId).sort();
}

describe("pendingPromptStore", () => {
  beforeEach(() => {
    usePendingPromptStore.setState({ promptsByTaskId: {} });
  });

  it("saves and reads back a pending prompt by taskId", () => {
    pendingPromptStore.save(record("t1", "do the thing"));

    expect(pendingPromptStore.get("t1")?.initialPrompt).toEqual([
      { type: "text", text: "do the thing" },
    ]);
  });

  it("returns undefined when no prompt is owed", () => {
    expect(pendingPromptStore.get("missing")).toBeUndefined();
  });

  it("overwrites the record for a task on a re-save (retry reuses the key)", () => {
    pendingPromptStore.save(record("t1", "first"));
    pendingPromptStore.save(record("t1", "second"));

    expect(storedTaskIds()).toEqual(["t1"]);
    expect(pendingPromptStore.get("t1")?.initialPrompt).toEqual([
      { type: "text", text: "second" },
    ]);
  });

  it("removes a delivered prompt and leaves others intact", () => {
    pendingPromptStore.save(record("t1", "one"));
    pendingPromptStore.save(record("t2", "two"));

    pendingPromptStore.remove("t1");

    expect(pendingPromptStore.get("t1")).toBeUndefined();
    expect(pendingPromptStore.get("t2")).toBeDefined();
    expect(storedTaskIds()).toEqual(["t2"]);
  });

  it("remove is a no-op for an unknown task", () => {
    pendingPromptStore.save(record("t1", "one"));
    pendingPromptStore.remove("nope");
    expect(storedTaskIds()).toEqual(["t1"]);
  });
});
