import { Theme } from "@radix-ui/themes";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RenderItem } from "./SessionUpdateView";
import { SessionUpdateView } from "./SessionUpdateView";

vi.mock("@renderer/trpc/client", () => ({
  trpcClient: {
    os: { openExternal: { mutate: vi.fn() } },
  },
}));

function thoughtChunk(text: string): RenderItem {
  return {
    sessionUpdate: "agent_thought_chunk",
    content: { type: "text", text },
  } as RenderItem;
}

describe("SessionUpdateView agent_thought_chunk", () => {
  it("renders a Thinking block for non-empty reasoning", () => {
    render(
      <Theme>
        <SessionUpdateView item={thoughtChunk("reasoning")} thoughtComplete />
      </Theme>,
    );

    expect(screen.getByText("Thinking")).toBeInTheDocument();
  });

  it("renders nothing for empty or whitespace-only reasoning", () => {
    const { container } = render(
      <Theme>
        <SessionUpdateView item={thoughtChunk("   \n  ")} thoughtComplete />
      </Theme>,
    );

    expect(screen.queryByText("Thinking")).not.toBeInTheDocument();
    expect(container.querySelector("button")).toBeNull();
  });
});
