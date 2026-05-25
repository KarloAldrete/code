import { createSidebarStore } from "@stores/createSidebarStore";

export const useInboxSignalsBoardDetailStore = createSidebarStore({
  name: "inbox-signals-board-detail-storage",
  defaultWidth: 560,
  defaultOpen: true,
});
