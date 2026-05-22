import { describe, expect, it } from "vitest";
import {
  groupByStatus,
  STATUS_GROUP_IDS,
  type StatusGroupableTask,
} from "./groupByStatus";

interface TestTask extends StatusGroupableTask {
  id: string;
}

function task(id: string, overrides: StatusGroupableTask = {}): TestTask {
  return { id, ...overrides };
}

describe("groupByStatus", () => {
  describe("bucket assignment", () => {
    it.each<[string, StatusGroupableTask, string]>([
      ["needsPermission", { needsPermission: true }, STATUS_GROUP_IDS.needsYou],
      ["isGenerating", { isGenerating: true }, STATUS_GROUP_IDS.active],
      [
        "taskRunStatus=queued",
        { taskRunStatus: "queued" },
        STATUS_GROUP_IDS.active,
      ],
      [
        "taskRunStatus=in_progress",
        { taskRunStatus: "in_progress" },
        STATUS_GROUP_IDS.active,
      ],
      [
        "taskRunStatus=completed",
        { taskRunStatus: "completed" },
        STATUS_GROUP_IDS.done,
      ],
      [
        "taskRunStatus=failed",
        { taskRunStatus: "failed" },
        STATUS_GROUP_IDS.failed,
      ],
      [
        "taskRunStatus=cancelled",
        { taskRunStatus: "cancelled" },
        STATUS_GROUP_IDS.failed,
      ],
      [
        "taskRunStatus=not_started",
        { taskRunStatus: "not_started" },
        STATUS_GROUP_IDS.idle,
      ],
      ["no signals", {}, STATUS_GROUP_IDS.idle],
    ])("routes a task with %s to the %s bucket", (_label, props, expected) => {
      const groups = groupByStatus([task("t", props)]);
      expect(groups).toHaveLength(1);
      expect(groups[0].id).toBe(expected);
      expect(groups[0].tasks.map((t) => t.id)).toEqual(["t"]);
    });
  });

  describe("predicate precedence", () => {
    it.each<[string, StatusGroupableTask, string]>([
      [
        "needsPermission vs in_progress → needs-you",
        { needsPermission: true, taskRunStatus: "in_progress" },
        STATUS_GROUP_IDS.needsYou,
      ],
      [
        "needsPermission vs isGenerating → needs-you",
        { needsPermission: true, isGenerating: true },
        STATUS_GROUP_IDS.needsYou,
      ],
      [
        "needsPermission vs completed → needs-you",
        { needsPermission: true, taskRunStatus: "completed" },
        STATUS_GROUP_IDS.needsYou,
      ],
      [
        "isGenerating vs completed → active",
        { isGenerating: true, taskRunStatus: "completed" },
        STATUS_GROUP_IDS.active,
      ],
    ])("resolves %s", (_label, props, expected) => {
      const groups = groupByStatus([task("t", props)]);
      expect(groups[0].id).toBe(expected);
    });
  });

  it("returns groups in the fixed display order and omits empty buckets", () => {
    const tasks: TestTask[] = [
      task("c", { taskRunStatus: "completed" }),
      task("f", { taskRunStatus: "failed" }),
      task("a", { taskRunStatus: "in_progress" }),
    ];

    const ids = groupByStatus(tasks).map((g) => g.id);
    expect(ids).toEqual([
      STATUS_GROUP_IDS.active,
      STATUS_GROUP_IDS.done,
      STATUS_GROUP_IDS.failed,
    ]);
  });

  it("returns an empty array when there are no tasks", () => {
    expect(groupByStatus([])).toEqual([]);
  });

  describe("preserves input order within each bucket", () => {
    it.each<[string, StatusGroupableTask]>([
      ["needs-you", { needsPermission: true }],
      ["active", { taskRunStatus: "in_progress" }],
      ["done", { taskRunStatus: "completed" }],
      ["failed", { taskRunStatus: "failed" }],
      ["idle", {}],
    ])("for the %s bucket", (_label, props) => {
      const tasks: TestTask[] = [
        task("a", props),
        task("b", props),
        task("c", props),
      ];
      const groups = groupByStatus(tasks);
      expect(groups[0].tasks.map((t) => t.id)).toEqual(["a", "b", "c"]);
    });
  });
});
