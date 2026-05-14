import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppMode = "code" | "analysis";

interface AppModeStoreState {
  mode: AppMode;
}

interface AppModeStoreActions {
  setMode: (mode: AppMode) => void;
  toggleMode: () => void;
}

type AppModeStore = AppModeStoreState & AppModeStoreActions;

export const useAppModeStore = create<AppModeStore>()(
  persist(
    (set) => ({
      mode: "code",
      setMode: (mode) => set({ mode }),
      toggleMode: () =>
        set((state) => ({ mode: state.mode === "code" ? "analysis" : "code" })),
    }),
    {
      name: "app-mode-storage",
      partialize: (state) => ({ mode: state.mode }) as unknown as AppModeStore,
    },
  ),
);
