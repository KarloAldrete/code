import { describe, expect, it, vi } from "vitest";
import { handlePlanDeletion } from "./handlePlanDeletion";

describe("handlePlanDeletion", () => {
  it("clears cache + dispatches onCleared when the deleted file is the one being viewed", () => {
    const clearCache = vi.fn();
    const onCleared = vi.fn();
    handlePlanDeletion({
      deletedPath: "/x/.claude/plans/foo.md",
      currentPath: "/x/.claude/plans/foo.md",
      clearCache,
      onCleared,
    });
    expect(clearCache).toHaveBeenCalledOnce();
    expect(onCleared).toHaveBeenCalledOnce();
  });

  it("does nothing when an unrelated plan file is deleted", () => {
    const clearCache = vi.fn();
    const onCleared = vi.fn();
    handlePlanDeletion({
      deletedPath: "/x/.claude/plans/other.md",
      currentPath: "/x/.claude/plans/foo.md",
      clearCache,
      onCleared,
    });
    expect(clearCache).not.toHaveBeenCalled();
    expect(onCleared).not.toHaveBeenCalled();
  });

  it("no-ops when there is no current plan being viewed", () => {
    const clearCache = vi.fn();
    const onCleared = vi.fn();
    handlePlanDeletion({
      deletedPath: "/x/.claude/plans/foo.md",
      currentPath: null,
      clearCache,
      onCleared,
    });
    expect(clearCache).not.toHaveBeenCalled();
    expect(onCleared).not.toHaveBeenCalled();
  });
});
