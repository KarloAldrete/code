import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FeedReadStoreState {
  readIds: Record<string, true>;
}

interface FeedReadStoreActions {
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
  markUnread: (id: string) => void;
  isRead: (id: string) => boolean;
}

type FeedReadStore = FeedReadStoreState & FeedReadStoreActions;

export const useFeedReadStore = create<FeedReadStore>()(
  persist(
    (set, get) => ({
      readIds: {},
      markRead: (id) =>
        set((state) => ({ readIds: { ...state.readIds, [id]: true } })),
      markAllRead: (ids) =>
        set((state) => {
          const next = { ...state.readIds };
          for (const id of ids) next[id] = true;
          return { readIds: next };
        }),
      markUnread: (id) =>
        set((state) => {
          const next = { ...state.readIds };
          delete next[id];
          return { readIds: next };
        }),
      isRead: (id) => Boolean(get().readIds[id]),
    }),
    {
      name: "feed-read-storage",
      version: 2,
      migrate: () => ({ readIds: {} }) as unknown as FeedReadStore,
      partialize: (state) =>
        ({ readIds: state.readIds }) as unknown as FeedReadStore,
    },
  ),
);
