import { describe, expect, it } from "vitest";
import { parseFastCommand } from "./commands";

describe("parseFastCommand", () => {
  it("parses standalone fast commands", () => {
    expect(parseFastCommand("/fast")).toEqual({
      serviceTier: "fast",
      content: "",
      commandOnly: true,
    });
  });

  it("treats trailing text as the prompt to run in fast mode", () => {
    expect(parseFastCommand("/fast fix the tests")).toEqual({
      serviceTier: "fast",
      content: "fix the tests",
      commandOnly: false,
    });
  });

  it("treats an immediate XML chip after fast as prompt content", () => {
    expect(parseFastCommand('/fast<file path="README.md" />')).toEqual({
      serviceTier: "fast",
      content: '<file path="README.md" />',
      commandOnly: false,
    });
  });

  it("supports explicit standard and flex tiers", () => {
    expect(parseFastCommand("/fast off")).toEqual({
      serviceTier: "standard",
      content: "",
      commandOnly: true,
    });
    expect(parseFastCommand("/fast flex retry flaky checks")).toEqual({
      serviceTier: "flex",
      content: "retry flaky checks",
      commandOnly: false,
    });
  });

  it("ignores non-fast slash commands", () => {
    expect(parseFastCommand("/fast-mode please")).toBeNull();
    expect(parseFastCommand("/feedback fast please")).toBeNull();
  });
});
