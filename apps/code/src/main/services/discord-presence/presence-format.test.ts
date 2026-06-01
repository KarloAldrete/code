import { describe, expect, it } from "vitest";
import { buildActivity } from "./presence-format";
import type { PresenceIntent } from "./schemas";

const STARTED_AT = 1_700_000_000_000;

const baseOptions = {
  showTaskTitle: false,
  showRepoName: false,
  startedAt: STARTED_AT,
};

const activeIntent: PresenceIntent = {
  hasActiveTask: true,
  taskTitle: "Add Discord presence",
  repoName: "posthog/code",
  agentRunning: true,
};

describe("buildActivity", () => {
  it("hides the task title and repo name by default (privacy-first)", () => {
    const activity = buildActivity(activeIntent, baseOptions);
    expect(activity.details).toBe("Working on a task");
    expect(activity.state).toBe("agent running");
  });

  it("includes the task title only when opted in", () => {
    const activity = buildActivity(activeIntent, {
      ...baseOptions,
      showTaskTitle: true,
    });
    expect(activity.details).toBe('Working on "Add Discord presence"');
  });

  it("includes the repo name only when opted in", () => {
    const activity = buildActivity(activeIntent, {
      ...baseOptions,
      showRepoName: true,
    });
    expect(activity.state).toBe("posthog/code · agent running");
  });

  it("reflects review status with the idle badge when the agent is idle on a task", () => {
    const activity = buildActivity(
      { ...activeIntent, agentRunning: false },
      { ...baseOptions, showRepoName: true },
    );
    expect(activity.state).toBe("posthog/code · reviewing");
    expect(activity.assets?.small_image).toBe("posthog_idle");
    expect(activity.assets?.small_text).toBe("Reviewing");
  });

  it("falls back to an idle/browsing presence with the idle badge when no task is focused", () => {
    const activity = buildActivity(
      {
        hasActiveTask: false,
        taskTitle: null,
        repoName: null,
        agentRunning: false,
      },
      { ...baseOptions, showTaskTitle: true, showRepoName: true },
    );
    expect(activity.details).toBe("Idle");
    expect(activity.state).toBe("browsing");
    expect(activity.assets?.small_image).toBe("posthog_idle");
    expect(activity.assets?.small_text).toBe("Idle");
  });

  it("surfaces the running indicator asset while the agent works", () => {
    const activity = buildActivity(activeIntent, baseOptions);
    expect(activity.assets?.small_image).toBe("agent_running");
    expect(activity.timestamps?.start).toBe(STARTED_AT);
  });

  it("truncates over-long titles to Discord's field limit", () => {
    const longTitle = "x".repeat(200);
    const activity = buildActivity(
      { ...activeIntent, taskTitle: longTitle },
      { ...baseOptions, showTaskTitle: true },
    );
    expect(activity.details).toBeDefined();
    expect((activity.details as string).length).toBeLessThanOrEqual(128);
  });
});
