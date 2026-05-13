import { electronStorage } from "@utils/electronStorage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface WorkSkill {
  id: string;
  name: string;
  prompt: string;
  taskId?: string;
  isSeed?: true;
}

interface WorkSkillsStoreState {
  skills: WorkSkill[];
}

interface WorkSkillsStoreActions {
  addSkill: (skill: WorkSkill) => void;
  updateSkill: (id: string, updates: Partial<WorkSkill>) => void;
  getSkill: (id: string) => WorkSkill | undefined;
}

type WorkSkillsStore = WorkSkillsStoreState & WorkSkillsStoreActions;

const SEED_SKILLS: WorkSkill[] = [
  {
    id: "seed-slack-overnight",
    name: "Check important Slack messages from overnight",
    prompt:
      "Each morning, surface high-signal Slack messages from overnight: mentions, replies in threads I'm in, and any messages in priority channels that look urgent.",
    isSeed: true,
  },
];

export const useWorkSkillsStore = create<WorkSkillsStore>()(
  persist(
    (set, get) => ({
      skills: SEED_SKILLS,
      addSkill: (skill) =>
        set((state) => ({ skills: [...state.skills, skill] })),
      updateSkill: (id, updates) =>
        set((state) => ({
          skills: state.skills.map((s) =>
            s.id === id ? { ...s, ...updates } : s,
          ),
        })),
      getSkill: (id) => get().skills.find((s) => s.id === id),
    }),
    {
      name: "work-skills-storage",
      storage: electronStorage,
      partialize: (state) => ({ skills: state.skills }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<WorkSkillsStoreState>;
        const persistedSkills = persistedState?.skills ?? [];
        const merged = [...SEED_SKILLS];
        for (const skill of persistedSkills) {
          if (!merged.some((s) => s.id === skill.id)) {
            merged.push(skill);
          }
        }
        return { ...current, skills: merged };
      },
    },
  ),
);
