import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUseCwd = vi.hoisted(() => vi.fn((): string | undefined => undefined));
const mockUseTasks = vi.hoisted(() =>
  vi.fn((): { data: Array<{ id: string; repository?: string | null }> } => ({
    data: [],
  })),
);

vi.mock("@features/sidebar/hooks/useCwd", () => ({ useCwd: mockUseCwd }));
vi.mock("@features/tasks/hooks/useTasks", () => ({ useTasks: mockUseTasks }));

import { useDisplayRepoPath } from "./useDisplayRepoPath";

describe("useDisplayRepoPath", () => {
  beforeEach(() => {
    mockUseCwd.mockReturnValue(undefined);
    mockUseTasks.mockReturnValue({ data: [] });
  });

  it("returns local cwd when available (local task)", () => {
    mockUseCwd.mockReturnValue("/Users/me/code/posthog");
    const { result } = renderHook(() => useDisplayRepoPath("task-1"));
    expect(result.current).toBe("/Users/me/code/posthog");
  });

  it("derives remote workspace path from task.repository when cwd is missing", () => {
    mockUseTasks.mockReturnValue({
      data: [{ id: "task-1", repository: "posthog/posthog.com" }],
    });
    const { result } = renderHook(() => useDisplayRepoPath("task-1"));
    expect(result.current).toBe("/tmp/workspace/repos/posthog/posthog.com");
  });

  it("prefers local cwd over derived remote path when both could resolve", () => {
    mockUseCwd.mockReturnValue("/Users/me/code/posthog");
    mockUseTasks.mockReturnValue({
      data: [{ id: "task-1", repository: "posthog/posthog.com" }],
    });
    const { result } = renderHook(() => useDisplayRepoPath("task-1"));
    expect(result.current).toBe("/Users/me/code/posthog");
  });

  it("returns undefined when task has no repository", () => {
    mockUseTasks.mockReturnValue({ data: [{ id: "task-1" }] });
    const { result } = renderHook(() => useDisplayRepoPath("task-1"));
    expect(result.current).toBeUndefined();
  });

  it("returns undefined when repository is malformed", () => {
    mockUseTasks.mockReturnValue({
      data: [{ id: "task-1", repository: "not-a-valid-repo-string" }],
    });
    const { result } = renderHook(() => useDisplayRepoPath("task-1"));
    expect(result.current).toBeUndefined();
  });

  it("returns undefined when task is not found", () => {
    mockUseTasks.mockReturnValue({
      data: [{ id: "other-task", repository: "posthog/posthog.com" }],
    });
    const { result } = renderHook(() => useDisplayRepoPath("task-1"));
    expect(result.current).toBeUndefined();
  });

  it("returns undefined when taskId is undefined", () => {
    mockUseTasks.mockReturnValue({
      data: [{ id: "task-1", repository: "posthog/posthog.com" }],
    });
    const { result } = renderHook(() => useDisplayRepoPath(undefined));
    expect(result.current).toBeUndefined();
  });
});
