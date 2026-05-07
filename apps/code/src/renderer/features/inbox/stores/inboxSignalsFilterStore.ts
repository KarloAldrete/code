import type {
  SignalReportOrderingField,
  SignalReportStatus,
} from "@shared/types";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type SignalSortField = Extract<
  SignalReportOrderingField,
  "priority" | "created_at" | "total_weight"
>;

type SignalSortDirection = "asc" | "desc";

export type SourceProduct =
  | "session_replay"
  | "error_tracking"
  | "llm_analytics"
  | "github"
  | "linear"
  | "zendesk"
  | "conversations";

const DEFAULT_STATUS_FILTER: SignalReportStatus[] = [
  "ready",
  "pending_input",
  "in_progress",
  "failed",
  "candidate",
  "potential",
];

interface InboxSignalsFilterState {
  sortField: SignalSortField;
  sortDirection: SignalSortDirection;
  searchQuery: string;
  statusFilter: SignalReportStatus[];
  /** Empty array means "all sources" (no filter). */
  sourceProductFilter: SourceProduct[];
  /** Empty array means "all suggested reviewers" (no filter). Stored as PostHog user UUID strings. */
  suggestedReviewerFilter: string[];
  /** Empty array means "all repositories" (no filter). Stored as `owner/repo` strings (lower-case). */
  repoFilter: string[];
}

interface InboxSignalsFilterActions {
  setSort: (field: SignalSortField, direction: SignalSortDirection) => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (statuses: SignalReportStatus[]) => void;
  toggleStatus: (status: SignalReportStatus) => void;
  toggleSourceProduct: (source: SourceProduct) => void;
  toggleSuggestedReviewer: (reviewerUuid: string) => void;
  setSuggestedReviewerFilter: (reviewerUuids: string[]) => void;
  toggleRepo: (repo: string) => void;
  setRepoFilter: (repos: string[]) => void;
  /** Reset all filters when a deep link arrives so the linked report isn't hidden. */
  resetFilters: () => void;
}

type InboxSignalsFilterStore = InboxSignalsFilterState &
  InboxSignalsFilterActions;

export const useInboxSignalsFilterStore = create<InboxSignalsFilterStore>()(
  persist(
    (set) => ({
      sortField: "priority",
      sortDirection: "asc",
      searchQuery: "",
      statusFilter: DEFAULT_STATUS_FILTER,
      sourceProductFilter: [],
      suggestedReviewerFilter: [],
      repoFilter: [],
      setSort: (sortField, sortDirection) => set({ sortField, sortDirection }),
      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setStatusFilter: (statusFilter) => set({ statusFilter }),
      toggleStatus: (status) =>
        set((state) => {
          const current = state.statusFilter;
          const next = current.includes(status)
            ? current.filter((s) => s !== status)
            : [...current, status];
          return { statusFilter: next.length > 0 ? next : current };
        }),
      toggleSourceProduct: (source) =>
        set((state) => {
          const current = state.sourceProductFilter;
          const next = current.includes(source)
            ? current.filter((s) => s !== source)
            : [...current, source];
          return { sourceProductFilter: next };
        }),
      toggleSuggestedReviewer: (reviewerUuid) =>
        set((state) => {
          const current = state.suggestedReviewerFilter;
          const next = current.includes(reviewerUuid)
            ? current.filter((uuid) => uuid !== reviewerUuid)
            : [...current, reviewerUuid];
          return { suggestedReviewerFilter: next };
        }),
      setSuggestedReviewerFilter: (reviewerUuids) =>
        set({
          suggestedReviewerFilter: Array.from(new Set(reviewerUuids)),
        }),
      toggleRepo: (repo) =>
        set((state) => {
          const normalized = repo.trim().toLowerCase();
          if (!normalized) return {};
          const current = state.repoFilter;
          const next = current.includes(normalized)
            ? current.filter((r) => r !== normalized)
            : [...current, normalized];
          return { repoFilter: next };
        }),
      setRepoFilter: (repos) =>
        set({
          repoFilter: Array.from(
            new Set(
              repos.map((repo) => repo.trim().toLowerCase()).filter(Boolean),
            ),
          ),
        }),
      resetFilters: () =>
        set({
          searchQuery: "",
          statusFilter: DEFAULT_STATUS_FILTER,
          sourceProductFilter: [],
          suggestedReviewerFilter: [],
          repoFilter: [],
        }),
    }),
    {
      name: "inbox-signals-filter-storage",
      partialize: (state) => ({
        sortField: state.sortField,
        sortDirection: state.sortDirection,
        statusFilter: state.statusFilter,
        sourceProductFilter: state.sourceProductFilter,
        suggestedReviewerFilter: state.suggestedReviewerFilter,
        repoFilter: state.repoFilter,
      }),
    },
  ),
);
