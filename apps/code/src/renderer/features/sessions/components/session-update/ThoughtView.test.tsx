import { Theme } from "@radix-ui/themes";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThoughtView } from "./ThoughtView";

function renderThought(content: string) {
  return render(
    <Theme>
      <ThoughtView content={content} isLoading={false} />
    </Theme>,
  );
}

describe("ThoughtView", () => {
  it("collapses by default and expands the reasoning on click", () => {
    renderThought("line one\nline two\nline three");

    const label = screen.getByText("Thinking");
    // Collapsed: reasoning not visible
    expect(screen.queryByText(/line one/)).not.toBeInTheDocument();

    fireEvent.click(label);

    // Expanded: full reasoning visible
    expect(screen.getByText(/line one/)).toBeInTheDocument();
    expect(screen.getByText(/line three/)).toBeInTheDocument();
  });

  it("renders the reasoning in smaller, more muted text", () => {
    renderThought("some reasoning");
    fireEvent.click(screen.getByText("Thinking"));

    const pre = screen.getByText("some reasoning");
    expect(pre.className).toContain("text-[12px]");
    expect(pre.className).toContain("text-gray-10");
  });

  it("keeps the toggle clickable", () => {
    renderThought("reasoning");
    const button = screen.getByText("Thinking").closest("button");
    expect(button).not.toBeNull();
    expect(button?.className).toContain("cursor-pointer");
  });
});
