import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../utils/logger.js", () => ({
  logger: {
    scope: () => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

import type { LlmGatewayService } from "../llm-gateway/service";
import { GoalSpecDraftService } from "./goal-spec-draft-service";

function createMockLlmGateway() {
  return {
    prompt: vi.fn(),
  } as unknown as LlmGatewayService & {
    prompt: ReturnType<typeof vi.fn>;
  };
}

describe("GoalSpecDraftService", () => {
  let llmGateway: ReturnType<typeof createMockLlmGateway>;
  let service: GoalSpecDraftService;

  beforeEach(() => {
    llmGateway = createMockLlmGateway();
    service = new GoalSpecDraftService(llmGateway);
  });

  it("returns the next clarifying question from the gateway", async () => {
    llmGateway.prompt.mockResolvedValue({
      content: JSON.stringify({
        kind: "ask_question",
        question: "Which metric should improve?",
      }),
      model: "claude-haiku-4-5",
      stopReason: "end_turn",
      usage: { inputTokens: 10, outputTokens: 5 },
    });

    await expect(
      service.respond({
        transcript: [{ role: "user", content: "Improve checkout" }],
        mapContext: { mapX: 10, mapY: 20 },
      }),
    ).resolves.toEqual({
      kind: "ask_question",
      question: "Which metric should improve?",
    });

    expect(llmGateway.prompt).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          role: "user",
          content: expect.stringContaining("Map placement: (10, 20)"),
        }),
      ],
      expect.objectContaining({ maxTokens: 900 }),
    );
  });

  it("returns an editable draft spec when enough context exists", async () => {
    llmGateway.prompt.mockResolvedValue({
      content: `Here you go:\n\n\`\`\`json\n${JSON.stringify({
        kind: "propose_spec",
        draft: {
          name: "Checkout lift",
          goalPrompt: "Improve checkout conversion by reducing payment errors.",
          definitionOfDone:
            "Payment-error rate is lower and the checkout runbook is updated.",
        },
      })}\n\`\`\``,
      model: "claude-haiku-4-5",
      stopReason: "end_turn",
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    await expect(
      service.respond({
        transcript: [
          { role: "user", content: "Improve checkout" },
          {
            role: "assistant",
            content: "Which metric should improve?",
          },
          {
            role: "user",
            content:
              "Reduce payment errors and update the runbook once dashboards prove the rate fell.",
          },
        ],
      }),
    ).resolves.toEqual({
      kind: "propose_spec",
      draft: {
        name: "Checkout lift",
        goalPrompt: "Improve checkout conversion by reducing payment errors.",
        definitionOfDone:
          "Payment-error rate is lower and the checkout runbook is updated.",
      },
    });
  });

  it("forces one clarification for an under-specified initial prompt", async () => {
    llmGateway.prompt.mockResolvedValue({
      content: JSON.stringify({
        kind: "propose_spec",
        draft: {
          name: "Checkout",
          goalPrompt: "Improve checkout",
          definitionOfDone: "Checkout is better.",
        },
      }),
      model: "claude-haiku-4-5",
      stopReason: "end_turn",
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    const response = await service.respond({
      transcript: [{ role: "user", content: "Improve checkout" }],
    });

    expect(response).toEqual({
      kind: "ask_question",
      question:
        "What outcome would make this goal clearly done, and are there any scope boundaries the hedgehog should respect?",
    });
    expect(llmGateway.prompt).toHaveBeenCalledTimes(1);
  });

  it("throws when the gateway response is not valid JSON", async () => {
    llmGateway.prompt.mockResolvedValue({
      content: "I cannot do that",
      model: "claude-haiku-4-5",
      stopReason: "end_turn",
      usage: { inputTokens: 10, outputTokens: 20 },
    });

    await expect(
      service.respond({
        transcript: [{ role: "user", content: "Improve checkout" }],
      }),
    ).rejects.toThrow("Goal draft response was not valid JSON");
  });
});
