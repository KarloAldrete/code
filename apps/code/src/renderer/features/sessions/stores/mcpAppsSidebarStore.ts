import { createSidebarStore } from "@stores/createSidebarStore";

export const useMcpAppsSidebarStore = createSidebarStore({
  name: "mcp-apps-sidebar-storage",
  defaultWidth: 380,
  defaultOpen: false,
});
