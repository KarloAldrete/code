import { create } from "zustand";

interface PlanFullscreenStoreState {
  activeFullscreenToolCallId: string | null;
}

interface PlanFullscreenStoreActions {
  setActive: (toolCallId: string) => void;
  clear: (toolCallId?: string) => void;
}

type PlanFullscreenStore = PlanFullscreenStoreState &
  PlanFullscreenStoreActions;

export const usePlanFullscreenStore = create<PlanFullscreenStore>()(
  (set, get) => ({
    activeFullscreenToolCallId: null,
    setActive: (toolCallId) => set({ activeFullscreenToolCallId: toolCallId }),
    clear: (toolCallId) => {
      if (toolCallId && get().activeFullscreenToolCallId !== toolCallId) return;
      set({ activeFullscreenToolCallId: null });
    },
  }),
);
