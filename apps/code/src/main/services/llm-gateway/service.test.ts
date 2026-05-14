import { describe, expect, it, vi } from "vitest";

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

vi.mock("@posthog/agent/posthog-api", () => ({
  getGatewayInvalidatePlanCacheUrl: vi.fn(),
  getGatewayUsageUrl: vi.fn(),
  getLlmGatewayUrl: vi.fn(() => "https://gateway.example.com"),
}));

import type { AuthService } from "../auth/service";
import { LlmGatewayService } from "./service";

function createAuthService() {
  return {
    getValidAccessToken: vi.fn().mockResolvedValue({
      accessToken: "test-access-token",
      apiHost: "https://app.posthog.com",
    }),
    authenticatedFetch: vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        id: "msg_123",
        type: "message",
        role: "assistant",
        content: [{ type: "text", text: "hello" }],
        model: "claude-opus-4-6",
        stop_reason: "end_turn",
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      }),
    }),
  } as unknown as AuthService & {
    authenticatedFetch: ReturnType<typeof vi.fn>;
  };
}

describe("LlmGatewayService", () => {
  it("passes beta headers and max effort through to the messages endpoint", async () => {
    const authService = createAuthService();
    const service = new LlmGatewayService(authService);

    await expect(
      service.prompt([{ role: "user", content: "Draft a goal" }], {
        model: "claude-opus-4-6",
        maxTokens: 128_000,
        betas: ["context-1m-2025-08-07"],
        effort: "max",
      }),
    ).resolves.toMatchObject({
      content: "hello",
      model: "claude-opus-4-6",
    });

    expect(authService.authenticatedFetch).toHaveBeenCalledTimes(1);
    const [, url, init] = authService.authenticatedFetch.mock.calls[0];
    expect(url).toBe("https://gateway.example.com/v1/messages");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "anthropic-beta": "context-1m-2025-08-07",
    });
    expect(JSON.parse(init.body)).toMatchObject({
      model: "claude-opus-4-6",
      max_tokens: 128_000,
      output_config: { effort: "max" },
    });
  });
});
