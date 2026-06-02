import type { SettingsCategory } from "@features/settings/types";
import { router } from "@renderer/router";

// This bridge isolates router calls used by Zustand stores so the stores
// don't import the router directly. Importing `@renderer/router` from a store
// would create a cycle through routeTree.gen.ts → __root.tsx → store, which
// works today only because ES module bindings are live.
//
// Once the navigationStore is deleted, the only consumer here is the settings
// store helpers — and ideally those go too as settings consumers move to
// useNavigate/<Link/>.

export function navigateToCode(): void {
  void router.navigate({ to: "/code" });
}

export function navigateToTaskDetail(taskId: string): void {
  void router.navigate({
    to: "/code/tasks/$taskId",
    params: { taskId },
  });
}

export function navigateToTaskPending(key: string): void {
  void router.navigate({
    to: "/code/tasks/pending/$key",
    params: { key },
  });
}

export function navigateToFolderSettings(folderId: string): void {
  void router.navigate({
    to: "/folders/$folderId",
    params: { folderId },
  });
}

export function navigateToInbox(): void {
  void router.navigate({ to: "/code/inbox" });
}

export function navigateToArchived(): void {
  void router.navigate({ to: "/code/archived" });
}

export function navigateToCommandCenter(): void {
  void router.navigate({ to: "/command-center" });
}

export function navigateToSkills(): void {
  void router.navigate({ to: "/skills" });
}

export function navigateToMcpServers(): void {
  void router.navigate({ to: "/mcp-servers" });
}

export function navigateToSettings(category: SettingsCategory): void {
  void router.navigate({
    to: "/settings/$category",
    params: { category },
  });
}

export function isOnSettingsRoute(): boolean {
  return router.state.matches.some((m) => m.routeId.startsWith("/settings"));
}

export function goBackInHistory(): void {
  router.history.back();
}
