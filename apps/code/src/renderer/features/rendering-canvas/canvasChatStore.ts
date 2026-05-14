import type { Task } from "@shared/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CanvasChatStoreState {
  open: boolean;
  activeTasks: Record<string, Task>;
}

interface CanvasChatStoreActions {
  setOpen: (open: boolean) => void;
  close: () => void;
  toggle: () => void;
  setActiveTask: (canvasId: string, task: Task) => void;
  clearActiveTask: (canvasId: string) => void;
}

type CanvasChatStore = CanvasChatStoreState & CanvasChatStoreActions;

export const useCanvasChatStore = create<CanvasChatStore>()(
  persist(
    (set) => ({
      open: false,
      activeTasks: {},
      setOpen: (open) => set({ open }),
      close: () => set({ open: false }),
      toggle: () => set((state) => ({ open: !state.open })),
      setActiveTask: (canvasId, task) =>
        set((state) => ({
          activeTasks: { ...state.activeTasks, [canvasId]: task },
        })),
      clearActiveTask: (canvasId) =>
        set((state) => {
          if (!(canvasId in state.activeTasks)) return state;
          const { [canvasId]: _, ...rest } = state.activeTasks;
          return { activeTasks: rest };
        }),
    }),
    {
      name: "canvas-chat-storage",
      partialize: (state) => ({ open: state.open }),
    },
  ),
);

export function useCanvasActiveTask(canvasId: string): Task | undefined {
  return useCanvasChatStore((s) => s.activeTasks[canvasId]);
}
