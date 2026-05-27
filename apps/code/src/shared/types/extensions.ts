export interface ExtensionCommandContribution {
  extensionId: string;
  name: string;
  description: string;
  input?: { hint: string };
}

export interface ExtensionPromptContribution {
  extensionId: string;
  name: string;
  description: string;
  input?: { hint: string };
}

export interface ExtensionToolContribution {
  extensionId: string;
  name: string;
  description: string;
}

export type ExtensionViewLocation = "sidebar" | "status-bar";

export interface ExtensionViewContributionBase {
  extensionId: string;
  id: string;
  location: ExtensionViewLocation;
  title: string;
  entry?: string;
  url?: string;
  html?: string;
}

export interface ExtensionSidebarContribution
  extends ExtensionViewContributionBase {
  location: "sidebar";
  icon?: string;
}

export interface ExtensionStatusBarContribution
  extends ExtensionViewContributionBase {
  location: "status-bar";
  priority?: number;
  width?: number;
}

export type ExtensionViewContribution =
  | ExtensionSidebarContribution
  | ExtensionStatusBarContribution;

export interface ExtensionInfo {
  id: string;
  name: string;
  displayName: string;
  version: string;
  description?: string;
  installPath: string;
  commands: ExtensionCommandContribution[];
  prompts: ExtensionPromptContribution[];
  tools?: ExtensionToolContribution[];
  sidebar: ExtensionSidebarContribution[];
  statusBar: ExtensionStatusBarContribution[];
  skillCount: number;
  loadErrors: string[];
}

export interface ExtensionChangedPayload {
  extensions: ExtensionInfo[];
}
