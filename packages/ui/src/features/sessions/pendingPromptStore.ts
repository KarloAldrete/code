import type {
  PendingPromptRecord,
  PendingPromptStore,
} from "@posthog/core/sessions/pendingPrompt";
import { electronStorage } from "@posthog/ui/shell/rendererStorage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PendingPromptState {
  /** Map of taskId -> the prompt owed delivery for that task. */
  promptsByTaskId: Record<string, PendingPromptRecord>;
}

interface PendingPromptActions {
  savePrompt: (record: PendingPromptRecord) => void;
  getPrompt: (taskId: string) => PendingPromptRecord | undefined;
  removePrompt: (taskId: string) => void;
}

type PendingPromptStoreState = PendingPromptState & PendingPromptActions;

export const usePendingPromptStore = create<PendingPromptStoreState>()(
  persist(
    (set, get) => ({
      promptsByTaskId: {},

      savePrompt: (record) =>
        set((state) => ({
          promptsByTaskId: {
            ...state.promptsByTaskId,
            [record.taskId]: record,
          },
        })),

      getPrompt: (taskId) => get().promptsByTaskId[taskId],

      removePrompt: (taskId) =>
        set((state) => {
          if (!(taskId in state.promptsByTaskId)) return state;
          const { [taskId]: _removed, ...rest } = state.promptsByTaskId;
          return { promptsByTaskId: rest };
        }),
    }),
    {
      name: "pending-prompt-storage",
      storage: electronStorage,
      partialize: (state) => ({ promptsByTaskId: state.promptsByTaskId }),
    },
  ),
);

/**
 * Non-hook adapter implementing the core {@link PendingPromptStore} contract,
 * wired into the session service dependencies.
 */
export const pendingPromptStore: PendingPromptStore = {
  save: (record) => usePendingPromptStore.getState().savePrompt(record),
  get: (taskId) => usePendingPromptStore.getState().getPrompt(taskId),
  remove: (taskId) => usePendingPromptStore.getState().removePrompt(taskId),
};
