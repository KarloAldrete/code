import { create } from "zustand";

export interface PopoverAnchorRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

interface PlanComposeState {
  open: boolean;
  anchorRect: PopoverAnchorRect | null;
  blockText: string | null;
  occurrence: number;
  filePath: string | null;
  taskId: string | null;
  openAt: (args: {
    anchorRect: PopoverAnchorRect;
    blockText: string;
    occurrence: number;
    filePath: string;
    taskId: string;
  }) => void;
  close: () => void;
}

export const usePlanComposeStore = create<PlanComposeState>((set) => ({
  open: false,
  anchorRect: null,
  blockText: null,
  occurrence: 0,
  filePath: null,
  taskId: null,
  openAt: ({ anchorRect, blockText, occurrence, filePath, taskId }) =>
    set({
      open: true,
      anchorRect,
      blockText,
      occurrence,
      filePath,
      taskId,
    }),
  close: () =>
    set({
      open: false,
      anchorRect: null,
      blockText: null,
      occurrence: 0,
      filePath: null,
      taskId: null,
    }),
}));
