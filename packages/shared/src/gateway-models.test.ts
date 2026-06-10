import { describe, expect, it } from "vitest";
import {
  formatGatewayModelName,
  isBlockedModelId,
  supportsReasoningEffort,
} from "./gateway-models";

describe("formatGatewayModelName", () => {
  it("keeps Claude models in friendly title case", () => {
    expect(
      formatGatewayModelName({
        id: "claude-opus-4-8",
        owned_by: "anthropic",
        context_window: 200000,
        supports_streaming: true,
        supports_vision: true,
      }),
    ).toBe("Claude Opus 4.8");
  });

  it("formats OpenAI models as raw lowercase model ids", () => {
    expect(
      formatGatewayModelName({
        id: "openai/gpt-5.5",
        owned_by: "openai",
        context_window: 200000,
        supports_streaming: true,
        supports_vision: true,
      }),
    ).toBe("gpt-5.5");
  });
});

describe("isBlockedModelId", () => {
  it.each([
    { modelId: "claude-haiku-4-5", expected: true },
    { modelId: "ANTHROPIC/CLAUDE-HAIKU-4-5", expected: true },
    { modelId: "gpt-5.3-codex", expected: true },
    { modelId: "claude-opus-4-8", expected: false },
    { modelId: "claude-sonnet-4-6", expected: false },
  ])("$modelId -> blocked=$expected", ({ modelId, expected }) => {
    expect(isBlockedModelId(modelId)).toBe(expected);
  });
});

describe("supportsReasoningEffort", () => {
  it.each([
    { modelId: "claude-opus-4-8", expected: true },
    { modelId: "claude-sonnet-4-6", expected: true },
    { modelId: "claude-fable-5", expected: true },
    { modelId: "some-future-model", expected: false },
  ])("$modelId -> effort=$expected", ({ modelId, expected }) => {
    expect(supportsReasoningEffort(modelId)).toBe(expected);
  });
});
