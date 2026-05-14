import { useAuthStateValue } from "@features/auth/hooks/authQueries";
import { useAuthenticatedQuery } from "@hooks/useAuthenticatedQuery";
import type { Schemas } from "@renderer/api/generated";
import { getCloudUrlFromRegion } from "@shared/utils/urls";
import { useMemo } from "react";
import type { FeedItem } from "../types";

const FEED_WINDOW_DAYS = 10;

function isWithinWindow(
  iso: string | null | undefined,
  windowMs: number,
): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= windowMs;
}

function isFullyRolledOut(flag: Schemas.FeatureFlag): boolean {
  const filters = flag.filters as
    | {
        groups?: Array<{
          rollout_percentage?: number | null;
          properties?: unknown[] | null;
        }>;
      }
    | undefined;
  const groups = filters?.groups;
  if (!groups || groups.length === 0) return false;
  return groups.some(
    (g) =>
      g.rollout_percentage === 100 &&
      (!g.properties || g.properties.length === 0),
  );
}

function flagUrl(baseUrl: string, projectId: number, id: number) {
  return `${baseUrl}/project/${projectId}/feature_flags/${id}`;
}

function surveyUrl(baseUrl: string, projectId: number, id: string) {
  return `${baseUrl}/project/${projectId}/surveys/${id}`;
}

function experimentUrl(baseUrl: string, projectId: number, id: number) {
  return `${baseUrl}/project/${projectId}/experiments/${id}`;
}

export function useFeed() {
  const projectId = useAuthStateValue((s) => s.projectId);
  const cloudRegion = useAuthStateValue((s) => s.cloudRegion);
  const baseUrl = cloudRegion ? getCloudUrlFromRegion(cloudRegion) : null;

  const flagsQuery = useAuthenticatedQuery<Schemas.PaginatedFeatureFlagList>(
    ["feed", "feature-flags", projectId],
    (client) => client.listFeatureFlags({ limit: 100, active: "true" }),
    { staleTime: 60_000 },
  );

  const surveysQuery = useAuthenticatedQuery<Schemas.PaginatedSurveyList>(
    ["feed", "surveys", projectId],
    (client) => client.listSurveys({ limit: 100 }),
    { staleTime: 60_000 },
  );

  const experimentsQuery =
    useAuthenticatedQuery<Schemas.PaginatedExperimentList>(
      ["feed", "experiments", projectId],
      (client) => client.listExperiments({ limit: 100 }),
      { staleTime: 60_000 },
    );

  const isLoading =
    flagsQuery.isLoading ||
    surveysQuery.isLoading ||
    experimentsQuery.isLoading;
  const error =
    flagsQuery.error ?? surveysQuery.error ?? experimentsQuery.error;

  const items = useMemo<FeedItem[]>(() => {
    if (!projectId || !baseUrl) return [];
    const windowMs = FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const result: FeedItem[] = [];

    for (const flag of flagsQuery.data?.results ?? []) {
      const createdRecently = isWithinWindow(flag.created_at ?? null, windowMs);
      const updatedRecently = isWithinWindow(flag.updated_at, windowMs);
      const fullyRolledOut = flag.active === true && isFullyRolledOut(flag);
      const title = flag.name?.trim() || flag.key;
      const description =
        flag.name?.trim() && flag.name.trim() !== flag.key ? flag.key : null;
      const url = flagUrl(baseUrl, projectId, flag.id);

      // Prefer the more recent state: a flag that launched at 100% within the
      // window shows as "rolled out"; otherwise "launched" if newly created.
      if (fullyRolledOut && updatedRecently) {
        result.push({
          id: `flag-${flag.id}-rolled-out`,
          kind: "feature_flag",
          event: "rolled_out_100",
          title,
          description,
          timestamp: flag.updated_at ?? flag.created_at ?? "",
          url,
        });
      } else if (createdRecently) {
        result.push({
          id: `flag-${flag.id}`,
          kind: "feature_flag",
          event: "launched",
          title,
          description,
          timestamp: flag.created_at ?? "",
          url,
        });
      }
    }

    for (const survey of surveysQuery.data?.results ?? []) {
      const launchedAt = survey.start_date ?? null;
      if (!isWithinWindow(launchedAt, windowMs)) continue;
      result.push({
        id: `survey-${survey.id}`,
        kind: "survey",
        event: "launched",
        title: survey.name,
        description: survey.description?.trim() || null,
        timestamp: launchedAt ?? "",
        url: surveyUrl(baseUrl, projectId, survey.id),
      });
    }

    for (const experiment of experimentsQuery.data?.results ?? []) {
      const startedAt = experiment.start_date ?? null;
      const endedAt = experiment.end_date ?? null;
      const url = experimentUrl(baseUrl, projectId, experiment.id);
      const description = experiment.description?.trim() || null;

      if (isWithinWindow(endedAt, windowMs)) {
        result.push({
          id: `experiment-${experiment.id}-concluded`,
          kind: "experiment",
          event: "concluded",
          title: experiment.name,
          description,
          timestamp: endedAt ?? "",
          url,
        });
      }

      if (isWithinWindow(startedAt, windowMs)) {
        result.push({
          id: `experiment-${experiment.id}-launched`,
          kind: "experiment",
          event: "launched",
          title: experiment.name,
          description,
          timestamp: startedAt ?? "",
          url,
        });
      }
    }

    result.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
    return result;
  }, [
    projectId,
    baseUrl,
    flagsQuery.data,
    surveysQuery.data,
    experimentsQuery.data,
  ]);

  return { items, isLoading, error };
}
