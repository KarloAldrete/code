import { electronStorage } from "@utils/electronStorage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ProjectChatsStoreState {
  chatIdByProjectId: Record<string, string>;
}

interface ProjectChatsStoreActions {
  setChatId: (projectId: string, chatId: string) => void;
  clearChatId: (projectId: string) => void;
  getChatId: (projectId: string) => string | undefined;
}

type ProjectChatsStore = ProjectChatsStoreState & ProjectChatsStoreActions;

export const useProjectChatsStore = create<ProjectChatsStore>()(
  persist(
    (set, get) => ({
      chatIdByProjectId: {},
      setChatId: (projectId, chatId) =>
        set((state) => ({
          chatIdByProjectId: {
            ...state.chatIdByProjectId,
            [projectId]: chatId,
          },
        })),
      clearChatId: (projectId) =>
        set((state) => {
          const next = { ...state.chatIdByProjectId };
          delete next[projectId];
          return { chatIdByProjectId: next };
        }),
      getChatId: (projectId) => get().chatIdByProjectId[projectId],
    }),
    {
      name: "project-chats-storage",
      storage: electronStorage,
    },
  ),
);
