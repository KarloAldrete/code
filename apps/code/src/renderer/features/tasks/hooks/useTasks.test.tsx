import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockInvalidateQueries = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
  keepPreviousData: Symbol("keepPreviousData"),
}));

const captured = vi.hoisted(() => ({
  value: null as {
    queryKey: unknown;
    options: Record<string, unknown>;
  } | null,
}));

vi.mock("@hooks/useAuthenticatedQuery", () => ({
  useAuthenticatedQuery: (
    queryKey: unknown,
    _queryFn: unknown,
    options: Record<string, unknown>,
  ) => {
    captured.value = { queryKey, options };
    return { data: [], isLoading: false };
  },
}));

vi.mock("@hooks/useAuthenticatedMutation", () => ({
  useAuthenticatedMutation: () => ({ mutateAsync: vi.fn(), mutate: vi.fn() }),
}));

vi.mock("@hooks/useMeQuery", () => ({
  useMeQuery: () => ({ data: { id: 42 } }),
}));

vi.mock("@features/sidebar/hooks/usePinnedTasks", () => ({
  pinnedTasksApi: { unpin: vi.fn() },
}));

vi.mock("@features/workspace/hooks/useWorkspace", () => ({
  workspaceApi: { get: vi.fn(), delete: vi.fn() },
}));

vi.mock("@renderer/stores/focusStore", () => ({
  useFocusStore: { getState: () => ({ session: null, disableFocus: vi.fn() }) },
}));

vi.mock("@renderer/stores/navigationStore", () => ({
  useNavigationStore: () => ({
    view: { type: "task-input" },
    navigateToTaskInput: vi.fn(),
  }),
}));

vi.mock("@renderer/trpc/client", () => ({
  trpcClient: {
    contextMenu: { confirmDeleteTask: { mutate: vi.fn() } },
  },
}));

vi.mock("@utils/logger", () => ({
  logger: {
    scope: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

import {
  TASK_LIST_POLL_MAX_MS,
  TASK_LIST_POLL_MIN_MS,
  useTasks,
} from "./useTasks";

type IntervalFn = () => number | false;

function getRefetchInterval(): IntervalFn {
  const interval = captured.value?.options.refetchInterval;
  if (typeof interval !== "function") {
    throw new Error("refetchInterval was not a function");
  }
  return interval as IntervalFn;
}

let hasFocusSpy: ReturnType<typeof vi.spyOn>;

function setFocused(focused: boolean): void {
  act(() => {
    hasFocusSpy.mockReturnValue(focused);
    window.dispatchEvent(new Event(focused ? "focus" : "blur"));
  });
}

describe("useTasks polling", () => {
  beforeEach(() => {
    hasFocusSpy = vi.spyOn(document, "hasFocus").mockReturnValue(true);
    window.dispatchEvent(new Event("focus"));
    mockInvalidateQueries.mockReset();
    captured.value = null;
  });

  afterEach(() => {
    hasFocusSpy.mockRestore();
  });

  it("starts polling at the minimum interval while focused", () => {
    renderHook(() => useTasks());
    expect(getRefetchInterval()()).toBe(TASK_LIST_POLL_MIN_MS);
  });

  it("exponentially backs off up to the maximum interval", () => {
    renderHook(() => useTasks());

    const refetchInterval = getRefetchInterval();
    const seen = [
      refetchInterval(),
      refetchInterval(),
      refetchInterval(),
      refetchInterval(),
      refetchInterval(),
    ];

    expect(seen).toEqual([
      TASK_LIST_POLL_MIN_MS,
      TASK_LIST_POLL_MIN_MS * 2,
      TASK_LIST_POLL_MIN_MS * 4,
      // 30s * 8 = 240s, clamped to 180s
      TASK_LIST_POLL_MAX_MS,
      TASK_LIST_POLL_MAX_MS,
    ]);
  });

  it("pauses polling when the window blurs", () => {
    const { rerender } = renderHook(() => useTasks());

    setFocused(false);
    rerender();

    const refetchInterval = getRefetchInterval();
    expect(refetchInterval()).toBe(false);
    expect(refetchInterval()).toBe(false);
  });

  it("resets backoff and invalidates the list on focus return", () => {
    const { rerender } = renderHook(() => useTasks());

    let refetchInterval = getRefetchInterval();
    refetchInterval();
    refetchInterval();
    refetchInterval();

    const queryKey = captured.value?.queryKey;

    setFocused(false);
    rerender();
    expect(mockInvalidateQueries).not.toHaveBeenCalled();

    setFocused(true);
    rerender();

    expect(mockInvalidateQueries).toHaveBeenCalledTimes(1);
    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey });

    refetchInterval = getRefetchInterval();
    expect(refetchInterval()).toBe(TASK_LIST_POLL_MIN_MS);
  });

  it("does not invalidate on the initial focused mount", () => {
    renderHook(() => useTasks());
    expect(mockInvalidateQueries).not.toHaveBeenCalled();
  });

  it("disables background polling so the query doesn't fire while hidden", () => {
    renderHook(() => useTasks());
    expect(captured.value?.options.refetchIntervalInBackground).toBe(false);
  });
});
