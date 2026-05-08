import { create } from "zustand";

export interface PlanAnnotationDraft {
  id: string;
  taskId: string;
  toolCallId: string;
  startLine: number;
  endLine: number;
  text: string;
  createdAt: number;
}

interface PlanAnnotationDraftsState {
  drafts: Record<string, PlanAnnotationDraft[]>;
}

interface PlanAnnotationDraftsActions {
  addDraft: (
    taskId: string,
    draft: Omit<PlanAnnotationDraft, "id" | "taskId" | "createdAt">,
  ) => string;
  updateDraft: (taskId: string, draftId: string, text: string) => void;
  removeDraft: (taskId: string, draftId: string) => void;
  getDraftsForToolCall: (
    taskId: string,
    toolCallId: string,
  ) => PlanAnnotationDraft[];
}

type PlanAnnotationDraftsStore = PlanAnnotationDraftsState &
  PlanAnnotationDraftsActions;

/**
 * Draft inline comments left on an agent plan while it awaits approval.
 *
 * Owned by the plan-annotation feature rather than borrowing the code-review
 * `reviewDraftsStore`: plan drafts are scoped by `toolCallId` (the pending
 * ExitPlanMode permission), have no diff `side`, and are batched into a single
 * rejection prompt on submit. Ephemeral, in-memory — drafts live only until
 * they are sent to the agent.
 */
export const usePlanAnnotationDraftsStore = create<PlanAnnotationDraftsStore>()(
  (set, get) => ({
    drafts: {},

    addDraft: (taskId, draft) => {
      const id = crypto.randomUUID();
      set((state) => {
        const existing = state.drafts[taskId] ?? [];
        const next: PlanAnnotationDraft = {
          id,
          taskId,
          createdAt: Date.now(),
          ...draft,
        };
        return {
          drafts: { ...state.drafts, [taskId]: [...existing, next] },
        };
      });
      return id;
    },

    updateDraft: (taskId, draftId, text) =>
      set((state) => {
        const existing = state.drafts[taskId];
        if (!existing) return state;
        return {
          drafts: {
            ...state.drafts,
            [taskId]: existing.map((d) =>
              d.id === draftId ? { ...d, text } : d,
            ),
          },
        };
      }),

    removeDraft: (taskId, draftId) =>
      set((state) => {
        const existing = state.drafts[taskId];
        if (!existing) return state;
        return {
          drafts: {
            ...state.drafts,
            [taskId]: existing.filter((d) => d.id !== draftId),
          },
        };
      }),

    getDraftsForToolCall: (taskId, toolCallId) =>
      (get().drafts[taskId] ?? []).filter((d) => d.toolCallId === toolCallId),
  }),
);
