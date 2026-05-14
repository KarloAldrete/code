import { electronStorage } from "@utils/electronStorage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface HogletPositionState {
  /** World-space overrides keyed by hoglet id. Absent → use default layout. */
  positions: Record<string, { x: number; y: number }>;
}

interface HogletPositionActions {
  setPosition: (hogletId: string, x: number, y: number) => void;
  clearPosition: (hogletId: string) => void;
  reset: () => void;
}

type HogletPositionStore = HogletPositionState & HogletPositionActions;

export const useHogletPositionStore = create<HogletPositionStore>()(
  persist(
    (set) => ({
      positions: {},
      setPosition: (hogletId, x, y) =>
        set((state) => ({
          positions: {
            ...state.positions,
            [hogletId]: { x: Math.round(x), y: Math.round(y) },
          },
        })),
      clearPosition: (hogletId) =>
        set((state) => {
          if (!(hogletId in state.positions)) return state;
          const next = { ...state.positions };
          delete next[hogletId];
          return { positions: next };
        }),
      reset: () => set({ positions: {} }),
    }),
    {
      name: "hedgemony-hoglet-positions",
      storage: electronStorage,
      partialize: (state) => ({ positions: state.positions }),
    },
  ),
);

export const selectHogletPosition =
  (hogletId: string) =>
  (state: HogletPositionStore): { x: number; y: number } | undefined =>
    state.positions[hogletId];
