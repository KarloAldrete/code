import { create } from "zustand";

export interface LongRunningTaskInfo {
  active: boolean;
  goal: string;
  successCriterion: string;
  marker: string;
  iterations: number;
  maxIterations: number;
}

export interface LongRunningTaskProposal {
  proposalId: string;
  goal: string;
  successCriterion: string;
  marker: string;
  maxIterations: number;
  approach: string | null;
}

interface LongRunningTaskStoreState {
  byTaskRunId: Record<string, LongRunningTaskInfo>;
  proposalsByTaskRunId: Record<string, LongRunningTaskProposal>;
}

interface LongRunningTaskStoreActions {
  setTask: (taskRunId: string, info: LongRunningTaskInfo) => void;
  clearTask: (taskRunId: string) => void;
  setProposal: (taskRunId: string, proposal: LongRunningTaskProposal) => void;
  clearProposal: (taskRunId: string) => void;
}

type LongRunningTaskStore = LongRunningTaskStoreState &
  LongRunningTaskStoreActions;

export const useLongRunningTaskStore = create<LongRunningTaskStore>((set) => ({
  byTaskRunId: {},
  proposalsByTaskRunId: {},
  setTask: (taskRunId, info) =>
    set((state) => ({
      byTaskRunId: { ...state.byTaskRunId, [taskRunId]: info },
      // A new active task supersedes any pending proposal for the same run.
      proposalsByTaskRunId: info.active
        ? omitKey(state.proposalsByTaskRunId, taskRunId)
        : state.proposalsByTaskRunId,
    })),
  clearTask: (taskRunId) =>
    set((state) => {
      if (!state.byTaskRunId[taskRunId]) return state;
      return { byTaskRunId: omitKey(state.byTaskRunId, taskRunId) };
    }),
  setProposal: (taskRunId, proposal) =>
    set((state) => ({
      proposalsByTaskRunId: {
        ...state.proposalsByTaskRunId,
        [taskRunId]: proposal,
      },
    })),
  clearProposal: (taskRunId) =>
    set((state) => {
      if (!state.proposalsByTaskRunId[taskRunId]) return state;
      return {
        proposalsByTaskRunId: omitKey(state.proposalsByTaskRunId, taskRunId),
      };
    }),
}));

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const { [key]: _, ...rest } = record;
  return rest;
}

export function selectLongRunningTask(
  taskRunId: string | null | undefined,
): LongRunningTaskInfo | null {
  if (!taskRunId) return null;
  return useLongRunningTaskStore.getState().byTaskRunId[taskRunId] ?? null;
}

export function selectLongRunningTaskProposal(
  taskRunId: string | null | undefined,
): LongRunningTaskProposal | null {
  if (!taskRunId) return null;
  return (
    useLongRunningTaskStore.getState().proposalsByTaskRunId[taskRunId] ?? null
  );
}
