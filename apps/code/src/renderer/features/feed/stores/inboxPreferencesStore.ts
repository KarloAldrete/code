import { create } from "zustand";
import { persist } from "zustand/middleware";

export type InboxTopicKey =
  | "newFeatureFlags"
  | "newExperiments"
  | "launchedSurveys"
  | "events"
  | "metricAnomalies"
  | "customerRiskScoreChanges"
  | "errors"
  | "codeFixesAndSuggestions";

export interface InboxPreferences {
  newFeatureFlags: boolean;
  newExperiments: boolean;
  launchedSurveys: boolean;
  events: boolean;
  metricAnomalies: boolean;
  customerRiskScoreChanges: boolean;
  errors: boolean;
  codeFixesAndSuggestions: boolean;
}

interface InboxPreferencesStoreState {
  hasCompletedWizard: boolean;
  preferences: InboxPreferences;
}

interface InboxPreferencesStoreActions {
  setPreference: (key: InboxTopicKey, value: boolean) => void;
  setAll: (preferences: InboxPreferences) => void;
  completeWizard: () => void;
  resetWizard: () => void;
}

type InboxPreferencesStore = InboxPreferencesStoreState &
  InboxPreferencesStoreActions;

const defaultPreferences: InboxPreferences = {
  newFeatureFlags: true,
  newExperiments: true,
  launchedSurveys: true,
  events: false,
  metricAnomalies: true,
  customerRiskScoreChanges: true,
  errors: true,
  codeFixesAndSuggestions: true,
};

export const useInboxPreferencesStore = create<InboxPreferencesStore>()(
  persist(
    (set) => ({
      hasCompletedWizard: false,
      preferences: defaultPreferences,
      setPreference: (key, value) =>
        set((state) => ({
          preferences: { ...state.preferences, [key]: value },
        })),
      setAll: (preferences) => set({ preferences }),
      completeWizard: () => set({ hasCompletedWizard: true }),
      resetWizard: () => set({ hasCompletedWizard: false }),
    }),
    {
      name: "inbox-preferences-storage",
      partialize: (state) => ({
        hasCompletedWizard: state.hasCompletedWizard,
        preferences: state.preferences,
      }),
    },
  ),
);
