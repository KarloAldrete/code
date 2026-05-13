import { electronStorage } from "@utils/electronStorage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ChatStoreState {
  chatTaskIds: string[];
}

interface ChatStoreActions {
  addChat: (taskId: string) => void;
  removeChat: (taskId: string) => void;
  isChat: (taskId: string) => boolean;
}

type ChatStore = ChatStoreState & ChatStoreActions;

export const useChatStore = create<ChatStore>()(
  persist(
    (set, get) => ({
      chatTaskIds: [],
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
    }),
    {
      name: "chat-storage",
      storage: electronStorage,
    },
  ),
);
