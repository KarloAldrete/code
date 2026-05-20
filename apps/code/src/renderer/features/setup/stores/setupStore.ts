import type { DiscoveredTask } from "@features/setup/types";
import { logger } from "@utils/logger";
import { create } from "zustand";
import { persist } from "zustand/middleware";

const log = logger.scope("setup-store");

type DiscoveryStatus = "idle" | "running" | "done" | "error";
type EnricherStatus = "idle" | "running" | "done" | "error";

interface ActivityEntry {
  id: number;
  toolCallId: string;
  tool: string;
  filePath: string | null;
  title: string;
}

export interface AgentFeedState {
  currentTool: string | null;
  currentFilePath: string | null;
  recentEntries: ActivityEntry[];
}

const EMPTY_FEED: AgentFeedState = {
  currentTool: null,
  currentFilePath: null,
  recentEntries: [],
};

interface SetupStoreState {
  discoveredTasks: DiscoveredTask[];
  discoveryStatus: DiscoveryStatus;
  discoveryTaskId: string | null;
  discoveryTaskRunId: string | null;
  // Repo the in-flight or last-completed discovery run targeted. Used to scope
  // which suggestions show on the new task page based on the currently
  // selected repo.
  discoveryRepoPath: string | null;
  discoveryFeed: AgentFeedState;
  enricherStatus: EnricherStatus;
  // Repo the in-flight or last-completed enricher run targeted.
  enricherRepoPath: string | null;
  error: string | null;
  selectedDiscoveredTaskId: string | null;
}

interface SetupStoreActions {
  startDiscovery: (taskId: string, taskRunId: string, repoPath: string) => void;
  completeDiscovery: (tasks: DiscoveredTask[], repoPath: string) => void;
  failDiscovery: (message?: string) => void;
  resetDiscovery: () => void;
  startEnrichment: (repoPath: string) => void;
  completeEnrichment: () => void;
  failEnrichment: () => void;
  removeDiscoveredTask: (taskId: string) => void;
  selectDiscoveredTask: (taskId: string | null) => void;
  addEnricherSuggestionIfMissing: (task: DiscoveredTask) => void;
  pushDiscoveryActivity: (entry: ActivityEntry) => void;
  resetSetup: () => void;
}

type SetupStore = SetupStoreState & SetupStoreActions;

const initialState: SetupStoreState = {
  discoveredTasks: [],
  discoveryStatus: "idle",
  discoveryTaskId: null,
  discoveryTaskRunId: null,
  discoveryRepoPath: null,
  discoveryFeed: EMPTY_FEED,
  enricherStatus: "idle",
  enricherRepoPath: null,
  error: null,
  selectedDiscoveredTaskId: null,
};

// Discovery resets only clear agent-source suggestions for the target repo;
// enricher-source suggestions and other repos' agent suggestions survive.
function clearAgentSuggestionsForRepo(
  tasks: DiscoveredTask[],
  repoPath: string,
): DiscoveredTask[] {
  return tasks.filter(
    (t) => t.source === "enricher" || t.repoPath !== repoPath,
  );
}

function pushEntry(prev: AgentFeedState, entry: ActivityEntry): AgentFeedState {
  const existingIdx = entry.toolCallId
    ? prev.recentEntries.findIndex((e) => e.toolCallId === entry.toolCallId)
    : -1;

  let newEntries: ActivityEntry[];
  if (existingIdx >= 0) {
    newEntries = [...prev.recentEntries];
    const old = newEntries[existingIdx];
    newEntries[existingIdx] = {
      ...old,
      tool: entry.tool || old.tool,
      filePath: entry.filePath || old.filePath,
      title: entry.title || old.title,
    };
  } else {
    newEntries = [...prev.recentEntries.slice(-4), entry];
  }

  return {
    currentTool: entry.tool,
    currentFilePath: entry.filePath ?? prev.currentFilePath,
    recentEntries: newEntries,
  };
}

export const useSetupStore = create<SetupStore>()(
  persist(
    (set) => ({
      ...initialState,

      // Starts a fresh agent run. Clears agent-source suggestions only for the
      // target repo — enricher-source and other repos' suggestions survive.
      startDiscovery: (taskId, taskRunId, repoPath) => {
        log.info("Discovery started", { taskId, taskRunId, repoPath });
        set((state) => ({
          discoveryStatus: "running",
          discoveryTaskId: taskId,
          discoveryTaskRunId: taskRunId,
          discoveryRepoPath: repoPath,
          discoveredTasks: clearAgentSuggestionsForRepo(
            state.discoveredTasks,
            repoPath,
          ),
          discoveryFeed: EMPTY_FEED,
          error: null,
        }));
      },

      // Replaces only the target repo's agent-source entries with the new
      // findings; enricher entries and other repos' suggestions stay put.
      completeDiscovery: (tasks, repoPath) => {
        log.info("Discovery completed", {
          taskCount: tasks.length,
          repoPath,
        });
        set((state) => {
          const kept = clearAgentSuggestionsForRepo(
            state.discoveredTasks,
            repoPath,
          );
          const agent = tasks.map((t) => ({
            ...t,
            source: "agent" as const,
            repoPath,
          }));
          return {
            discoveryStatus: "done",
            discoveryRepoPath: repoPath,
            discoveredTasks: [...kept, ...agent],
            error: null,
          };
        });
      },

      failDiscovery: (message) => {
        log.warn("Discovery failed", { message });
        set({ discoveryStatus: "error", error: message ?? null });
      },

      resetDiscovery: () => {
        log.info("Discovery reset");
        set((state) => {
          const repoPath = state.discoveryRepoPath;
          return {
            discoveryStatus: "idle",
            discoveryTaskId: null,
            discoveryTaskRunId: null,
            discoveryRepoPath: null,
            discoveredTasks: repoPath
              ? clearAgentSuggestionsForRepo(state.discoveredTasks, repoPath)
              : state.discoveredTasks.filter((t) => t.source === "enricher"),
            discoveryFeed: EMPTY_FEED,
            error: null,
          };
        });
      },

      startEnrichment: (repoPath) => {
        set({ enricherStatus: "running", enricherRepoPath: repoPath });
      },

      completeEnrichment: () => {
        set({ enricherStatus: "done" });
      },

      failEnrichment: () => {
        set({ enricherStatus: "error" });
      },

      removeDiscoveredTask: (taskId) => {
        set((state) => ({
          discoveredTasks: state.discoveredTasks.filter((t) => t.id !== taskId),
          selectedDiscoveredTaskId:
            state.selectedDiscoveredTaskId === taskId
              ? null
              : state.selectedDiscoveredTaskId,
        }));
      },

      selectDiscoveredTask: (taskId) => {
        set({ selectedDiscoveredTaskId: taskId });
      },

      // Adds an enricher-source suggestion if there isn't already one with
      // the same id. Idempotent — safe to call repeatedly on every detection
      // run. Dismissed suggestions stay dismissed until `resetSetup`.
      addEnricherSuggestionIfMissing: (task) => {
        set((state) => {
          if (state.discoveredTasks.some((t) => t.id === task.id)) {
            return state;
          }
          return {
            discoveredTasks: [
              { ...task, source: "enricher" as const },
              ...state.discoveredTasks,
            ],
          };
        });
      },

      pushDiscoveryActivity: (entry) => {
        set((state) => ({
          discoveryFeed: pushEntry(state.discoveryFeed, entry),
        }));
      },

      resetSetup: () => {
        log.info("Setup state reset");
        set({ ...initialState });
      },
    }),
    {
      name: "setup-store",
      partialize: (state) => ({
        discoveredTasks: state.discoveredTasks,
        discoveryStatus:
          state.discoveryStatus === "done"
            ? ("done" as const)
            : ("idle" as const),
        discoveryRepoPath: state.discoveryRepoPath,
      }),
    },
  ),
);
