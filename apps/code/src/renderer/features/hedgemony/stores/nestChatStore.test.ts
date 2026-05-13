import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListNestChat = vi.hoisted(() => vi.fn());

vi.mock("@renderer/trpc/client", () => ({
  trpcClient: {
    hedgemony: {
      nestChat: {
        list: {
          query: mockListNestChat,
        },
      },
    },
  },
}));

vi.mock("@utils/logger", () => ({
  logger: {
    scope: () => ({
      error: vi.fn(),
    }),
  },
}));

import type { NestMessage } from "@main/services/hedgemony/schemas";
import { selectNestMessages, useNestChatStore } from "./nestChatStore";

const message = {
  id: "message-1",
  nestId: "nest-1",
  kind: "audit",
  visibility: "summary",
  sourceTaskId: null,
  body: "Nest created",
  payloadJson: null,
  createdAt: "2026-05-13T00:00:00.000Z",
} satisfies NestMessage;

describe("nestChatStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useNestChatStore.setState({
      messagesByNestId: {},
      loadingByNestId: {},
    });
  });

  it("loads messages through the tRPC boundary", async () => {
    mockListNestChat.mockResolvedValue([message]);

    await useNestChatStore.getState().load("nest-1");

    expect(mockListNestChat).toHaveBeenCalledWith({ nestId: "nest-1" });
    expect(selectNestMessages("nest-1")(useNestChatStore.getState())).toEqual([
      message,
    ]);
    expect(useNestChatStore.getState().loadingByNestId["nest-1"]).toBe(false);
  });

  it("clears loading state when the tRPC call fails", async () => {
    mockListNestChat.mockRejectedValue(new Error("boom"));

    await useNestChatStore.getState().load("nest-1");

    expect(selectNestMessages("nest-1")(useNestChatStore.getState())).toEqual(
      [],
    );
    expect(useNestChatStore.getState().loadingByNestId["nest-1"]).toBe(false);
  });

  it("returns an empty list when no nest is selected", () => {
    expect(selectNestMessages(null)(useNestChatStore.getState())).toEqual([]);
  });
});
