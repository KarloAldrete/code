import type { SettingsCategory } from "@features/settings/types";
import { getRouter } from "@renderer/routerRef";

// This bridge isolates imperative router calls behind a stable API and, by
// reaching the router through `routerRef` (a leaf module) rather than importing
// `@renderer/router` directly, keeps itself out of the route-tree import cycle:
//   router.ts → routeTree.gen.ts → __root.tsx → hooks → navigationBridge
// A static `import { router }` here would close that loop and break code-split
// route chunks (TDZ on `rootRouteImport`). See routerRef.ts.

export function navigateToCode(): void {
  void getRouter().navigate({ to: "/code" });
}

export function navigateToTaskDetail(taskId: string): void {
  void getRouter().navigate({
    to: "/code/tasks/$taskId",
    params: { taskId },
  });
}

export function navigateToTaskPending(key: string): void {
  void getRouter().navigate({
    to: "/code/tasks/pending/$key",
    params: { key },
  });
}

export function navigateToFolderSettings(folderId: string): void {
  void getRouter().navigate({
    to: "/folders/$folderId",
    params: { folderId },
  });
}

export function navigateToInbox(): void {
  void getRouter().navigate({ to: "/code/inbox" });
}

export function navigateToArchived(): void {
  void getRouter().navigate({ to: "/code/archived" });
}

export function navigateToCommandCenter(): void {
  void getRouter().navigate({ to: "/command-center" });
}

export function navigateToSkills(): void {
  void getRouter().navigate({ to: "/skills" });
}

export function navigateToMcpServers(): void {
  void getRouter().navigate({ to: "/mcp-servers" });
}

export function navigateToSettings(category: SettingsCategory): void {
  void getRouter().navigate({
    to: "/settings/$category",
    params: { category },
  });
}

export function isOnSettingsRoute(): boolean {
  return getRouter().state.matches.some((m) =>
    m.routeId.startsWith("/settings"),
  );
}

export function goBackInHistory(): void {
  getRouter().history.back();
}

export function goForwardInHistory(): void {
  getRouter().history.forward();
}

// Accessors for code that needs to read router state outside of React (e.g.
// Zustand actions, imperative event handlers). Components should prefer the
// `useRouterState` hook from `@tanstack/react-router`.
export function getCurrentMatches() {
  return getRouter().state.matches;
}

export function getCurrentLocation() {
  return getRouter().state.location;
}

export function subscribeToRouterResolved(handler: () => void): () => void {
  const unsub = getRouter().subscribe("onResolved", handler);
  return unsub;
}
