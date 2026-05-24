import { describe, expect, it } from "vitest";
import { taskListPollInterval } from "./taskListPollInterval";

describe("taskListPollInterval", () => {
  it("polls every 30s during the first 30s after focus", () => {
    expect(taskListPollInterval(0)).toBe(30_000);
    expect(taskListPollInterval(15_000)).toBe(30_000);
    expect(taskListPollInterval(29_999)).toBe(30_000);
  });

  it("backs off to 60s once the 30s tier completes one tick", () => {
    expect(taskListPollInterval(30_000)).toBe(60_000);
    expect(taskListPollInterval(89_999)).toBe(60_000);
  });

  it("backs off to 120s once the 60s tier completes one tick", () => {
    expect(taskListPollInterval(90_000)).toBe(120_000);
    expect(taskListPollInterval(209_999)).toBe(120_000);
  });

  it("settles at 180s after the 120s tier completes one tick", () => {
    expect(taskListPollInterval(210_000)).toBe(180_000);
    expect(taskListPollInterval(10 * 60_000)).toBe(180_000);
    expect(taskListPollInterval(Number.MAX_SAFE_INTEGER)).toBe(180_000);
  });
});
