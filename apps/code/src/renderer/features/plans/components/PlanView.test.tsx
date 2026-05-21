import { Theme } from "@radix-ui/themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { ensureWatchingMutate, planThreadsEnabledMock } = vi.hoisted(() => ({
  ensureWatchingMutate: vi.fn().mockResolvedValue(undefined),
  planThreadsEnabledMock: vi.fn().mockReturnValue(false),
}));

vi.mock("@renderer/trpc", () => ({
  trpc: {
    plans: {
      read: {
        queryOptions: (input: { filePath: string }) => ({
          queryKey: ["plans.read", input],
          queryFn: () => Promise.resolve({ content: "# Hello" }),
          staleTime: 0,
        }),
        queryFilter: (input: { filePath: string }) => ({
          queryKey: ["plans.read", input],
        }),
        queryKey: (input: { filePath: string }) => ["plans.read", input],
      },
      onChanged: {
        subscriptionOptions: () => ({
          subscriptionKey: "plans.onChanged",
          subscribe: () => () => undefined,
        }),
      },
      onDeleted: {
        subscriptionOptions: () => ({
          subscriptionKey: "plans.onDeleted",
          subscribe: () => () => undefined,
        }),
      },
    },
  },
  trpcClient: {
    plans: {
      ensureWatching: { mutate: ensureWatchingMutate },
    },
  },
}));

vi.mock("@renderer/trpc/client", () => ({
  trpcClient: {
    plans: {
      ensureWatching: { mutate: ensureWatchingMutate },
    },
  },
}));

vi.mock("@trpc/tanstack-react-query", () => ({
  useSubscription: () => undefined,
}));

const pendingPermissionsMock = vi.hoisted(() => vi.fn(() => new Map()));
vi.mock("@features/sessions/hooks/useSession", () => ({
  usePendingPermissionsForTask: () => pendingPermissionsMock(),
}));

vi.mock("@features/sessions/service/service", () => ({
  getSessionService: () => ({
    respondToPermission: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("@features/settings/stores/settingsStore", () => ({
  useSettingsStore: (
    selector: (s: { planThreadsEnabled: boolean }) => unknown,
  ) => selector({ planThreadsEnabled: planThreadsEnabledMock() }),
}));

import { PlanView } from "./PlanView";

function renderPlanView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <Theme>
        <PlanView taskId="task-1" filePath="/tmp/plans/x.md" />
      </Theme>
    </QueryClientProvider>,
  );
}

describe("PlanView gating", () => {
  beforeEach(() => {
    ensureWatchingMutate.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders a disabled placeholder and does NOT start the watcher when the setting is off", () => {
    planThreadsEnabledMock.mockReturnValue(false);

    renderPlanView();

    expect(screen.getByText(/plan view is disabled/i)).toBeInTheDocument();
    expect(ensureWatchingMutate).not.toHaveBeenCalled();
  });

  it("starts the watcher when the setting is on", () => {
    planThreadsEnabledMock.mockReturnValue(true);

    renderPlanView();

    expect(ensureWatchingMutate).toHaveBeenCalledTimes(1);
  });
});

describe("PlanView approval bar", () => {
  beforeEach(() => {
    pendingPermissionsMock.mockReset();
    planThreadsEnabledMock.mockReturnValue(true);
  });

  it("renders Approve, Reject, and the mode Select when a switch_mode permission is pending", async () => {
    pendingPermissionsMock.mockReturnValue(
      new Map([
        [
          "tc-1",
          {
            taskRunId: "task-1",
            receivedAt: 0,
            options: [
              {
                optionId: "bypassPermissions",
                name: "Yes, bypass all permissions",
                kind: "allow_always",
              },
              { optionId: "auto", name: 'Yes, "auto"', kind: "allow_always" },
              {
                optionId: "default",
                name: "Yes, manually approve edits",
                kind: "allow_once",
              },
              {
                optionId: "reject_with_feedback",
                name: "No, give feedback",
                kind: "reject_once",
              },
            ],
            toolCall: {
              toolCallId: "tc-1",
              title: "Ready to code?",
              kind: "switch_mode",
              content: [],
              locations: [],
              rawInput: {},
            },
          },
        ],
      ]) as never,
    );

    renderPlanView();
    // Wait for the query to resolve and the inner to render the bar.
    await screen.findByText("The agent is waiting for plan approval.");

    expect(screen.getByText("Approve plan")).toBeInTheDocument();
    expect(screen.getByText("Reject")).toBeInTheDocument();
    expect(screen.getByText("Mode")).toBeInTheDocument();
    // Default should be `default` (manual approval), not bypassPermissions.
    expect(screen.getByText("Yes, manually approve edits")).toBeInTheDocument();
  });
});
