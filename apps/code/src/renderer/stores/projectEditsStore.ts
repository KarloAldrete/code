import type { ProjectIconId } from "@features/work/data/projectIcons";
import { electronStorage } from "@utils/electronStorage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface ProjectEdit {
  name?: string;
  description?: string;
  iconId?: ProjectIconId;
}

interface ProjectEditsStoreState {
  editsByProjectId: Record<string, ProjectEdit>;
}

interface ProjectEditsStoreActions {
  setEdit: (projectId: string, edit: ProjectEdit) => void;
  patchEdit: (projectId: string, patch: ProjectEdit) => void;
  clearEdit: (projectId: string) => void;
  getEdit: (projectId: string) => ProjectEdit | undefined;
}

type ProjectEditsStore = ProjectEditsStoreState & ProjectEditsStoreActions;

export const useProjectEditsStore = create<ProjectEditsStore>()(
  persist(
    (set, get) => ({
      editsByProjectId: {},
      setEdit: (projectId, edit) =>
        set((state) => ({
          editsByProjectId: { ...state.editsByProjectId, [projectId]: edit },
        })),
      patchEdit: (projectId, patch) =>
        set((state) => ({
          editsByProjectId: {
            ...state.editsByProjectId,
            [projectId]: {
              ...(state.editsByProjectId[projectId] ?? {}),
              ...patch,
            },
          },
        })),
      clearEdit: (projectId) =>
        set((state) => {
          const next = { ...state.editsByProjectId };
          delete next[projectId];
          return { editsByProjectId: next };
        }),
      getEdit: (projectId) => get().editsByProjectId[projectId],
    }),
    {
      name: "project-edits-storage",
      storage: electronStorage,
    },
  ),
);
