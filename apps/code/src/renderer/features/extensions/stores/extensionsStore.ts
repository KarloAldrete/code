import type {
  ExtensionCommandContribution,
  ExtensionInfo,
  ExtensionPromptContribution,
  ExtensionSidebarContribution,
  ExtensionStatusBarContribution,
} from "@shared/types/extensions";
import { create } from "zustand";

interface ExtensionsState {
  extensions: ExtensionInfo[];
  commands: ExtensionCommandContribution[];
  prompts: ExtensionPromptContribution[];
  sidebar: ExtensionSidebarContribution[];
  statusBar: ExtensionStatusBarContribution[];
  isLoaded: boolean;
}

interface ExtensionsActions {
  setExtensions: (extensions: ExtensionInfo[]) => void;
  clear: () => void;
}

type ExtensionsStore = ExtensionsState & { actions: ExtensionsActions };

function flattenCommands(
  extensions: ExtensionInfo[],
): ExtensionCommandContribution[] {
  return extensions.flatMap((extension) => extension.commands);
}

function flattenPrompts(
  extensions: ExtensionInfo[],
): ExtensionPromptContribution[] {
  return extensions.flatMap((extension) => extension.prompts);
}

function flattenSidebar(
  extensions: ExtensionInfo[],
): ExtensionSidebarContribution[] {
  return extensions.flatMap((extension) => extension.sidebar);
}

function flattenStatusBar(
  extensions: ExtensionInfo[],
): ExtensionStatusBarContribution[] {
  return extensions
    .flatMap((extension) => extension.statusBar)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export const useExtensionsStore = create<ExtensionsStore>()((set) => ({
  extensions: [],
  commands: [],
  prompts: [],
  sidebar: [],
  statusBar: [],
  isLoaded: false,
  actions: {
    setExtensions: (extensions) => {
      set({
        extensions,
        commands: flattenCommands(extensions),
        prompts: flattenPrompts(extensions),
        sidebar: flattenSidebar(extensions),
        statusBar: flattenStatusBar(extensions),
        isLoaded: true,
      });
    },
    clear: () => {
      set({
        extensions: [],
        commands: [],
        prompts: [],
        sidebar: [],
        statusBar: [],
        isLoaded: false,
      });
    },
  },
}));
