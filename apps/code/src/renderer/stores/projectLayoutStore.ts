import { electronStorage } from "@utils/electronStorage";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ProjectWidgetId =
  | "headline"
  | "activity"
  | "dashboards"
  | "automations"
  | "files"
  | "pinnedSkills";

export const PROJECT_WIDGET_IDS: ProjectWidgetId[] = [
  "headline",
  "activity",
  "dashboards",
  "automations",
  "files",
  "pinnedSkills",
];

export interface WidgetRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ProjectGridBreakpoint = "lg" | "md" | "sm";

export type ProjectGridLayouts = Record<
  ProjectGridBreakpoint,
  Record<ProjectWidgetId, WidgetRect>
>;

export interface ProjectLayout {
  layouts: ProjectGridLayouts;
  hidden: ProjectWidgetId[];
  version: number;
}

export const PROJECT_LAYOUT_VERSION = 1;

export const PROJECT_GRID_COLS: Record<ProjectGridBreakpoint, number> = {
  lg: 12,
  md: 8,
  sm: 4,
};

export const PROJECT_GRID_BREAKPOINTS: Record<ProjectGridBreakpoint, number> = {
  lg: 1024,
  md: 640,
  sm: 0,
};

export const PROJECT_GRID_ROW_HEIGHT = 40;

export const DEFAULT_PROJECT_LAYOUT: ProjectGridLayouts = {
  lg: {
    headline: { x: 0, y: 0, w: 12, h: 4 },
    activity: { x: 0, y: 4, w: 12, h: 8 },
    dashboards: { x: 0, y: 12, w: 6, h: 7 },
    automations: { x: 6, y: 12, w: 6, h: 7 },
    files: { x: 0, y: 19, w: 6, h: 6 },
    pinnedSkills: { x: 6, y: 19, w: 6, h: 6 },
  },
  md: {
    headline: { x: 0, y: 0, w: 8, h: 4 },
    activity: { x: 0, y: 4, w: 8, h: 8 },
    dashboards: { x: 0, y: 12, w: 4, h: 7 },
    automations: { x: 4, y: 12, w: 4, h: 7 },
    files: { x: 0, y: 19, w: 4, h: 6 },
    pinnedSkills: { x: 4, y: 19, w: 4, h: 6 },
  },
  sm: {
    headline: { x: 0, y: 0, w: 4, h: 4 },
    activity: { x: 0, y: 4, w: 4, h: 8 },
    dashboards: { x: 0, y: 12, w: 4, h: 7 },
    automations: { x: 0, y: 19, w: 4, h: 7 },
    files: { x: 0, y: 26, w: 4, h: 6 },
    pinnedSkills: { x: 0, y: 32, w: 4, h: 6 },
  },
};

function defaultLayout(): ProjectLayout {
  return {
    layouts: cloneLayouts(DEFAULT_PROJECT_LAYOUT),
    hidden: [],
    version: PROJECT_LAYOUT_VERSION,
  };
}

function cloneLayouts(src: ProjectGridLayouts): ProjectGridLayouts {
  return {
    lg: { ...src.lg },
    md: { ...src.md },
    sm: { ...src.sm },
  };
}

interface ProjectLayoutStoreState {
  layoutsByProjectId: Record<string, ProjectLayout>;
}

interface ProjectLayoutStoreActions {
  getLayout: (projectId: string) => ProjectLayout;
  setBreakpointLayout: (
    projectId: string,
    breakpoint: ProjectGridBreakpoint,
    rects: Record<ProjectWidgetId, WidgetRect>,
  ) => void;
  hideWidget: (projectId: string, widgetId: ProjectWidgetId) => void;
  showWidget: (projectId: string, widgetId: ProjectWidgetId) => void;
  resetLayout: (projectId: string) => void;
}

type ProjectLayoutStore = ProjectLayoutStoreState & ProjectLayoutStoreActions;

export const useProjectLayoutStore = create<ProjectLayoutStore>()(
  persist(
    (set, get) => ({
      layoutsByProjectId: {},
      getLayout: (projectId) =>
        get().layoutsByProjectId[projectId] ?? defaultLayout(),
      setBreakpointLayout: (projectId, breakpoint, rects) =>
        set((state) => {
          const existing =
            state.layoutsByProjectId[projectId] ?? defaultLayout();
          return {
            layoutsByProjectId: {
              ...state.layoutsByProjectId,
              [projectId]: {
                ...existing,
                layouts: {
                  ...existing.layouts,
                  [breakpoint]: rects,
                },
              },
            },
          };
        }),
      hideWidget: (projectId, widgetId) =>
        set((state) => {
          const existing =
            state.layoutsByProjectId[projectId] ?? defaultLayout();
          if (existing.hidden.includes(widgetId)) return state;
          return {
            layoutsByProjectId: {
              ...state.layoutsByProjectId,
              [projectId]: {
                ...existing,
                hidden: [...existing.hidden, widgetId],
              },
            },
          };
        }),
      showWidget: (projectId, widgetId) =>
        set((state) => {
          const existing =
            state.layoutsByProjectId[projectId] ?? defaultLayout();
          if (!existing.hidden.includes(widgetId)) return state;
          return {
            layoutsByProjectId: {
              ...state.layoutsByProjectId,
              [projectId]: {
                ...existing,
                hidden: existing.hidden.filter((id) => id !== widgetId),
              },
            },
          };
        }),
      resetLayout: (projectId) =>
        set((state) => {
          const next = { ...state.layoutsByProjectId };
          delete next[projectId];
          return { layoutsByProjectId: next };
        }),
    }),
    {
      name: "project-layout-storage",
      storage: electronStorage,
      migrate: (persisted: unknown, fromVersion: number) => {
        if (fromVersion < PROJECT_LAYOUT_VERSION) {
          return { layoutsByProjectId: {} };
        }
        return persisted as ProjectLayoutStoreState;
      },
      version: PROJECT_LAYOUT_VERSION,
    },
  ),
);
