import { electronStorage } from "@utils/electronStorage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatStoreState {
  chatTaskIds: string[];
  archivedChats: Record<string, { archivedAt: string }>;
}

interface ChatStoreActions {
  addChat: (taskId: string) => void;
  removeChat: (taskId: string) => void;
  isChat: (taskId: string) => boolean;
  archiveChat: (taskId: string) => void;
  unarchiveChat: (taskId: string) => void;
  deleteArchivedChat: (taskId: string) => void;
  isArchivedChat: (taskId: string) => boolean;
}

type ChatStore = ChatStoreState & ChatStoreActions;

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      chatTaskIds: [],
      archivedChats: {},
      addChat: (taskId: string) =>
        set((state) =>
          state.chatTaskIds.includes(taskId)
            ? state
            : { chatTaskIds: [taskId, ...state.chatTaskIds] },
        ),
      removeChat: (taskId: string) =>
        set((state) => ({
          chatTaskIds: state.chatTaskIds.filter((id) => id !== taskId),
        })),
      isChat: (taskId: string) => get().chatTaskIds.includes(taskId),
      archiveChat: (taskId: string) =>
        set((state) =>
          state.archivedChats[taskId]
            ? state
            : {
                archivedChats: {
                  ...state.archivedChats,
                  [taskId]: { archivedAt: new Date().toISOString() },
                },
              },
        ),
      unarchiveChat: (taskId: string) =>
        set((state) => {
          if (!state.archivedChats[taskId]) return state;
          const { [taskId]: _, ...rest } = state.archivedChats;
          return { archivedChats: rest };
        }),
      deleteArchivedChat: (taskId: string) =>
        set((state) => {
          const { [taskId]: _, ...rest } = state.archivedChats;
          return {
            archivedChats: rest,
            chatTaskIds: state.chatTaskIds.filter((id) => id !== taskId),
          };
        }),
      isArchivedChat: (taskId: string) => !!get().archivedChats[taskId],
    }),
    {
      name: "chat-storage",
      storage: electronStorage,
    },
  ),
);
