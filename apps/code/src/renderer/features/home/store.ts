import { create } from "zustand";
import { persist } from "zustand/middleware";

export type HomeRole =
  | "engineering"
  | "product"
  | "design"
  | "sales"
  | "marketing"
  | "data"
  | "leadership"
  | "support"
  | "other";

export interface HomeAnswers {
  role: HomeRole | null;
  products: string[];
  useCases: string[];
}

interface HomeStoreState {
  completed: boolean;
  answers: HomeAnswers;
}

interface HomeStoreActions {
  setAnswers: (answers: HomeAnswers) => void;
  complete: (answers: HomeAnswers) => void;
  reset: () => void;
}

type HomeStore = HomeStoreState & HomeStoreActions;

const EMPTY_ANSWERS: HomeAnswers = {
  role: null,
  products: [],
  useCases: [],
};

export const useHomeStore = create<HomeStore>()(
  persist(
    (set) => ({
      completed: false,
      answers: EMPTY_ANSWERS,
      setAnswers: (answers) => set({ answers }),
      complete: (answers) => set({ completed: true, answers }),
      reset: () => set({ completed: false, answers: EMPTY_ANSWERS }),
    }),
    {
      name: "home-onboarding-storage",
      partialize: (state) =>
        ({
          completed: state.completed,
          answers: state.answers,
        }) as unknown as HomeStore,
    },
  ),
);
