import type { SettingsCategory } from "@features/settings/types";
import {
  goBackInHistory,
  isOnSettingsRoute,
  navigateToSettings,
} from "@renderer/navigationBridge";
import { create } from "zustand";

export type { SettingsCategory };

interface SettingsDialogContext {
  repoPath?: string;
}

interface SettingsDialogState {
  isOpen: boolean;
  activeCategory: SettingsCategory;
  context: SettingsDialogContext;
  initialAction: string | null;
  formMode: boolean;
}

interface SettingsDialogActions {
  open: (
    category?: SettingsCategory,
    contextOrAction?: SettingsDialogContext | string,
  ) => void;
  close: () => void;
  setCategory: (category: SettingsCategory) => void;
  clearContext: () => void;
  consumeInitialAction: () => string | null;
  setFormMode: (formMode: boolean) => void;
}

type SettingsDialogStore = SettingsDialogState & SettingsDialogActions;

export const useSettingsDialogStore = create<SettingsDialogStore>()(
  (set, get) => ({
    isOpen: false,
    activeCategory: "general",
    context: {},
    initialAction: null,
    formMode: false,

    open: (category, contextOrAction) => {
      const isAction = typeof contextOrAction === "string";
      const nextCategory = category ?? get().activeCategory;
      set({
        isOpen: true,
        activeCategory: nextCategory,
        context: isAction ? {} : (contextOrAction ?? {}),
        initialAction: isAction ? contextOrAction : null,
        formMode: false,
      });
      // Router push handles browser-history integration; we no longer need a
      // manual window.history.pushState (which was colliding with hashHistory).
      navigateToSettings(nextCategory);
    },
    close: () => {
      const wasOpen = get().isOpen;
      set({
        isOpen: false,
        context: {},
        initialAction: null,
        formMode: false,
      });
      if (!wasOpen) return;
      if (isOnSettingsRoute()) {
        // Prefer history.back() so the user returns to their prior context
        // (e.g. /code/inbox), not a hard reset to /code.
        goBackInHistory();
      }
    },
    setCategory: (category) => {
      set({ activeCategory: category, initialAction: null, formMode: false });
      navigateToSettings(category);
    },
    clearContext: () => set({ context: {} }),
    consumeInitialAction: () => {
      const action = get().initialAction;
      if (action) set({ initialAction: null });
      return action;
    },
    setFormMode: (formMode) => set({ formMode }),
  }),
);
