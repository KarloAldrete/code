import { Theme } from "@radix-ui/themes";
import { act, fireEvent, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@renderer/trpc/client", () => ({
  trpcClient: {
    plans: {
      appendThreadMessage: { mutate: vi.fn().mockResolvedValue(undefined) },
      resolveThread: { mutate: vi.fn().mockResolvedValue(undefined) },
    },
  },
}));

vi.mock("@features/sessions/service/service", () => ({
  getSessionService: () => ({
    sendPrompt: vi.fn().mockResolvedValue({ stopReason: "ok" }),
    respondToPermission: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@features/sessions/hooks/useSession", async () => {
  const actual = await vi.importActual<
    typeof import("@features/sessions/hooks/useSession")
  >("@features/sessions/hooks/useSession");
  return {
    ...actual,
    getPendingPermissionsForTask: vi.fn(() => new Map()),
  };
});

vi.mock("@features/editor/components/MarkdownRenderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => <>{content}</>,
}));

import { PlanListItemGutter } from "./PlanListItemGutter";

describe("PlanListItemGutter — DOM validity inside <ul>/<ol>", () => {
  it("renders as a direct <li> child of the parent <ul>, not wrapped in a <div>", () => {
    const { container } = render(
      <Theme>
        <ul>
          <PlanListItemGutter
            blockText="- First item"
            occurrence={0}
            filePath="/x/plan.md"
            taskId="task-1"
          >
            First item
          </PlanListItemGutter>
        </ul>
      </Theme>,
    );

    const ul = container.querySelector("ul");
    expect(ul).not.toBeNull();
    // Every direct child of the <ul> must be a <li> for valid DOM.
    const directChildren = Array.from(ul?.children ?? []);
    expect(directChildren.length).toBeGreaterThan(0);
    for (const child of directChildren) {
      expect(child.tagName.toLowerCase()).toBe("li");
    }
  });

  it("opens the composer inside the anchor <li> so it doesn't add an extra list item", () => {
    const { container, getAllByLabelText, getByPlaceholderText } = render(
      <Theme>
        <ol>
          <PlanListItemGutter
            blockText="1. Anchor item"
            occurrence={0}
            filePath="/x/plan.md"
            taskId="task-1"
          >
            Anchor item
          </PlanListItemGutter>
          <PlanListItemGutter
            blockText="2. Next item"
            occurrence={0}
            filePath="/x/plan.md"
            taskId="task-1"
          >
            Next item
          </PlanListItemGutter>
        </ol>
      </Theme>,
    );

    const ol = container.querySelector("ol");
    expect(ol).not.toBeNull();
    const initialItemCount = ol?.children.length ?? 0;
    expect(initialItemCount).toBe(2);

    const addButtons = getAllByLabelText("Add a comment");
    act(() => {
      fireEvent.click(addButtons[0]);
    });

    // The composer's textarea must be inside the first anchor <li>,
    // not as a new sibling — otherwise an <ol> renumbers and the next
    // step's marker shifts while the user is typing.
    expect(ol?.children.length).toBe(initialItemCount);

    const textarea = getByPlaceholderText(/add a comment/i);
    const anchorLi = ol?.children[0];
    expect(anchorLi?.contains(textarea)).toBe(true);
  });
});
