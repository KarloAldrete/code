import { fetch } from "expo/fetch";
import { HttpError } from "@/features/tasks/api";
import { getBaseUrl, getHeaders, getProjectId } from "@/lib/api";
import { logger } from "@/lib/logger";

const log = logger.scope("inbox-api");

import type {
  AvailableSuggestedReviewer,
  AvailableSuggestedReviewersResponse,
  SignalProcessingStateResponse,
  SignalReport,
  SignalReportsQueryParams,
  SignalReportsResponse,
  SignalReportTask,
} from "./types";

export async function getSignalReports(
  params?: SignalReportsQueryParams,
): Promise<SignalReportsResponse> {
  const baseUrl = getBaseUrl();
  const projectId = getProjectId();
  const headers = getHeaders();

  const url = new URL(`${baseUrl}/api/projects/${projectId}/signals/reports/`);

  if (params?.limit != null) {
    url.searchParams.set("limit", String(params.limit));
  }
  if (params?.offset != null) {
    url.searchParams.set("offset", String(params.offset));
  }
  if (params?.status) {
    url.searchParams.set("status", params.status);
  }
  if (params?.ordering) {
    url.searchParams.set("ordering", params.ordering);
  }
  if (params?.source_product) {
    url.searchParams.set("source_product", params.source_product);
  }
  if (params?.suggested_reviewers) {
    url.searchParams.set("suggested_reviewers", params.suggested_reviewers);
  }

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    throw new HttpError(
      response.status,
      response.statusText,
      "Failed to fetch signal reports",
    );
  }

  const data = await response.json();
  return {
    results: data.results ?? [],
    count: data.count ?? data.results?.length ?? 0,
  };
}

export async function getSignalReport(
  reportId: string,
): Promise<SignalReport | null> {
  const baseUrl = getBaseUrl();
  const projectId = getProjectId();
  const headers = getHeaders();

  const response = await fetch(
    `${baseUrl}/api/projects/${projectId}/signals/reports/${reportId}/`,
    { headers },
  );

  if (response.status === 404 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new HttpError(
      response.status,
      response.statusText,
      "Failed to fetch signal report",
    );
  }

  return await response.json();
}

export async function getSignalProcessingState(): Promise<SignalProcessingStateResponse> {
  const baseUrl = getBaseUrl();
  const projectId = getProjectId();
  const headers = getHeaders();

  const response = await fetch(
    `${baseUrl}/api/projects/${projectId}/signals/processing_state/`,
    { headers },
  );

  if (!response.ok) {
    throw new HttpError(
      response.status,
      response.statusText,
      "Failed to fetch signal processing state",
    );
  }

  return await response.json();
}

export async function getAvailableSuggestedReviewers(
  query?: string,
): Promise<AvailableSuggestedReviewersResponse> {
  const baseUrl = getBaseUrl();
  const projectId = getProjectId();
  const headers = getHeaders();

  const url = new URL(
    `${baseUrl}/api/projects/${projectId}/signals/reports/available_reviewers/`,
  );

  if (query?.trim()) {
    url.searchParams.set("query", query.trim());
  }

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    throw new HttpError(
      response.status,
      response.statusText,
      "Failed to fetch available suggested reviewers",
    );
  }

  // API returns a dict keyed by UUID: { "uuid": { name, email, github_login } }
  const data = await response.json();
  const results = Object.entries(data)
    .map(([uuid, value]) => {
      if (typeof value !== "object" || value === null) return null;
      const v = value as Record<string, unknown>;
      return {
        uuid,
        name: typeof v.name === "string" ? v.name : "",
        email: typeof v.email === "string" ? v.email : "",
        github_login: typeof v.github_login === "string" ? v.github_login : "",
      };
    })
    .filter((r): r is AvailableSuggestedReviewer => r !== null);

  return { results, count: results.length };
}

export async function getSignalReportTasks(
  reportId: string,
): Promise<SignalReportTask[]> {
  const baseUrl = getBaseUrl();
  const projectId = getProjectId();
  const headers = getHeaders();

  const response = await fetch(
    `${baseUrl}/api/projects/${projectId}/signals/reports/${reportId}/tasks/`,
    { headers },
  );

  if (!response.ok) {
    throw new HttpError(
      response.status,
      response.statusText,
      "Failed to fetch signal report tasks",
    );
  }

  const data = await response.json();
  return data.results ?? [];
}

/** Resolve the repository associated with a signal report via its repo_selection artefact. */
export async function getReportRepository(
  reportId: string,
): Promise<string | null> {
  const baseUrl = getBaseUrl();
  const projectId = getProjectId();
  const headers = getHeaders();

  const response = await fetch(
    `${baseUrl}/api/projects/${projectId}/signals/reports/${reportId}/artefacts/`,
    { headers },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    log.warn("Failed to fetch report artefacts", {
      reportId,
      status: response.status,
      body: body.slice(0, 500),
    });
    return null;
  }

  const data = await response.json();
  const artefacts: { type: string; content: unknown }[] = data.results ?? [];
  const repoArtefact = artefacts.find((a) => a.type === "repo_selection");

  if (!repoArtefact) return null;

  // content may be a JSON string or an already-parsed object
  let parsed: unknown = repoArtefact.content;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      // Plain string like "org/repo"
      return (parsed as string).toLowerCase();
    }
  }

  if (typeof parsed === "object" && parsed !== null) {
    const repo =
      (parsed as Record<string, unknown>).repository ??
      (parsed as Record<string, unknown>).repo;
    if (typeof repo === "string") return repo.toLowerCase();
  }

  return null;
}
