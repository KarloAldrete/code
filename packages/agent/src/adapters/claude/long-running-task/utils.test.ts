import { describe, expect, it } from "vitest";
import { extractProposal } from "./utils";

describe("extractProposal", () => {
  it("parses a well-formed proposal block", () => {
    const text = `I've explored the codebase. Here is the proposal:

<long-running-task-config>
{
  "goal": "Reduce bundle size below 500KB",
  "successCriterion": "du -b dist/main.js < 500000",
  "marker": "<TASK_COMPLETE>",
  "maxIterations": 20,
  "approach": "Use source-map-explorer"
}
</long-running-task-config>

Ready to start when you approve.`;

    const result = extractProposal(text);
    expect(result).toEqual({
      goal: "Reduce bundle size below 500KB",
      successCriterion: "du -b dist/main.js < 500000",
      marker: "<TASK_COMPLETE>",
      maxIterations: 20,
      approach: "Use source-map-explorer",
    });
  });

  it("applies defaults for marker and maxIterations", () => {
    const text = `<long-running-task-config>
{ "goal": "Fix tests", "successCriterion": "all tests pass" }
</long-running-task-config>`;

    const result = extractProposal(text);
    expect(result?.marker).toBe("<TASK_COMPLETE>");
    expect(result?.maxIterations).toBe(20);
  });

  it("returns null when block is missing", () => {
    expect(extractProposal("just a regular message")).toBeNull();
  });

  it("returns null when JSON is malformed", () => {
    const text = `<long-running-task-config>
{ this is not json }
</long-running-task-config>`;
    expect(extractProposal(text)).toBeNull();
  });

  it("returns null when required fields are missing", () => {
    const text = `<long-running-task-config>
{ "goal": "fix something" }
</long-running-task-config>`;
    expect(extractProposal(text)).toBeNull();
  });

  it("rejects out-of-range maxIterations", () => {
    const text = `<long-running-task-config>
{ "goal": "x", "successCriterion": "y", "maxIterations": 9999 }
</long-running-task-config>`;
    expect(extractProposal(text)).toBeNull();
  });
});
