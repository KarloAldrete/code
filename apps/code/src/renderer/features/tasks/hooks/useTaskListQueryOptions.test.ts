import { useRendererWindowFocusStore } from "@renderer/stores/rendererWindowFocusStore";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  TASK_LIST_FOCUSED_POLL_INTERVAL_MS,
  useTaskListQueryOptions,
} from "./useTaskListQueryOptions";

describe("useTaskListQueryOptions", () => {
  beforeEach(() => {
    useRendererWindowFocusStore.setState({ focused: true });
  });

  it("disables polling when the window is not focused", () => {
    useRendererWindowFocusStore.setState({ focused: false });
    const { result } = renderHook(() => useTaskListQueryOptions());
    expect(result.current.refetchInterval).toBe(false);
  });

  it("polls at the focused interval when the window is focused", () => {
    useRendererWindowFocusStore.setState({ focused: true });
    const { result } = renderHook(() => useTaskListQueryOptions());
    expect(result.current.refetchInterval).toBe(
      TASK_LIST_FOCUSED_POLL_INTERVAL_MS,
    );
  });

  it('forces "always" refetch on focus to bypass the global staleTime', () => {
    const { result } = renderHook(() => useTaskListQueryOptions());
    expect(result.current.refetchOnWindowFocus).toBe("always");
  });
});
