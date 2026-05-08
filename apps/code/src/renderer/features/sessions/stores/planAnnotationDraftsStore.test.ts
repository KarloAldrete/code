import { beforeEach, describe, expect, it } from "vitest";
import { usePlanAnnotationDraftsStore } from "./planAnnotationDraftsStore";

const store = usePlanAnnotationDraftsStore;

beforeEach(() => {
  store.setState({ drafts: {} });
});

describe("planAnnotationDraftsStore", () => {
  it("adds a draft scoped to a task and tool call", () => {
    const id = store.getState().addDraft("t1", {
      toolCallId: "tc1",
      startLine: 5,
      endLine: 7,
      text: "rework",
    });

    const drafts = store.getState().drafts.t1;
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      id,
      taskId: "t1",
      toolCallId: "tc1",
      startLine: 5,
      endLine: 7,
      text: "rework",
    });
    expect(typeof drafts[0].createdAt).toBe("number");
  });

  it("updates a draft's text", () => {
    const id = store.getState().addDraft("t1", {
      toolCallId: "tc1",
      startLine: 1,
      endLine: 1,
      text: "old",
    });

    store.getState().updateDraft("t1", id, "new");
    expect(store.getState().drafts.t1[0].text).toBe("new");
  });

  it("removes a draft", () => {
    const id = store.getState().addDraft("t1", {
      toolCallId: "tc1",
      startLine: 1,
      endLine: 1,
      text: "x",
    });

    store.getState().removeDraft("t1", id);
    expect(store.getState().drafts.t1).toHaveLength(0);
  });

  it("getDraftsForToolCall filters by tool call within a task", () => {
    store.getState().addDraft("t1", {
      toolCallId: "tc1",
      startLine: 1,
      endLine: 1,
      text: "a",
    });
    store.getState().addDraft("t1", {
      toolCallId: "tc2",
      startLine: 2,
      endLine: 2,
      text: "b",
    });

    const forTc1 = store.getState().getDraftsForToolCall("t1", "tc1");
    expect(forTc1).toHaveLength(1);
    expect(forTc1[0].text).toBe("a");
  });

  it("keeps drafts isolated across tasks", () => {
    store.getState().addDraft("t1", {
      toolCallId: "tc1",
      startLine: 1,
      endLine: 1,
      text: "a",
    });
    store.getState().addDraft("t2", {
      toolCallId: "tc1",
      startLine: 1,
      endLine: 1,
      text: "b",
    });

    expect(store.getState().drafts.t1).toHaveLength(1);
    expect(store.getState().drafts.t2).toHaveLength(1);
    expect(store.getState().getDraftsForToolCall("t1", "tc1")[0].text).toBe(
      "a",
    );
  });

  it("update/remove on a missing task is a no-op", () => {
    store.getState().updateDraft("nope", "x", "y");
    store.getState().removeDraft("nope", "x");
    expect(store.getState().drafts.nope).toBeUndefined();
  });
});
