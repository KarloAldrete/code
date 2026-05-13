export type SignalReportStatus =
  | "potential"
  | "candidate"
  | "in_progress"
  | "ready"
  | "failed"
  | "pending_input"
  | "suppressed"
  | "deleted";

export type SignalReportPriority = "P0" | "P1" | "P2" | "P3" | "P4";

export type SignalReportActionability =
  | "immediately_actionable"
  | "requires_human_input"
  | "not_actionable";

export interface SignalReport {
  id: string;
  title: string | null;
  summary: string | null;
  status: SignalReportStatus;
  total_weight: number;
  signal_count: number;
  signals_at_run?: number;
  created_at: string;
  updated_at: string;
  artefact_count: number;
  priority?: SignalReportPriority | null;
  actionability?: SignalReportActionability | null;
  already_addressed?: boolean | null;
  is_suggested_reviewer?: boolean;
  source_products?: string[];
  implementation_pr_url?: string | null;
}

export interface SignalReportsResponse {
  results: SignalReport[];
  count: number;
}

export type SignalReportOrderingField =
  | "priority"
  | "signal_count"
  | "total_weight"
  | "created_at"
  | "updated_at";

export interface SignalReportsQueryParams {
  limit?: number;
  offset?: number;
  status?: string;
  ordering?: string;
  source_product?: string;
  suggested_reviewers?: string;
}

export interface SignalProcessingStateResponse {
  paused_until: string | null;
}

export interface AvailableSuggestedReviewer {
  uuid: string;
  name: string;
  email: string;
  github_login: string;
}

export interface AvailableSuggestedReviewersResponse {
  results: AvailableSuggestedReviewer[];
  count: number;
}

export interface SignalReportTask {
  id: string;
  relationship: string;
  task_id: string;
  created_at: string;
}
