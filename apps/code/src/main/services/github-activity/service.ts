import { execGh } from "@posthog/git/gh";
import type {
  GithubActivityItem,
  GithubActivitySummary,
  GithubActivityType,
} from "@shared/types/work-projects";
import { injectable } from "inversify";
import { logger } from "../../utils/logger";

const log = logger.scope("github-activity-service");

const RECENT_LIMIT = 10;
const PER_TYPE_LIMIT = 50;
const GH_API = "https://api.github.com";

interface FetchActivityParams {
  repo: { owner: string; name: string };
  enabledTypes: GithubActivityType[];
  windowDays: number;
}

/** Raw shapes returned by GitHub's REST API. Only fields we actually read. */
interface RestPr {
  number: number;
  title: string;
  html_url: string;
  merged_at: string | null;
  created_at: string;
  user: { login?: string | null } | null;
}

interface RestIssue {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  user: { login?: string | null } | null;
  /** Present when the issue is actually a PR. We filter these out. */
  pull_request?: unknown;
}

interface RestRelease {
  name: string | null;
  tag_name: string;
  published_at: string | null;
  html_url: string;
}

function emptyCounts(): GithubActivitySummary["counts"] {
  return { pr_merged: 0, pr_opened: 0, issue_opened: 0 };
}

@injectable()
export class GithubActivityService {
  /** Cached `gh auth token` result. Refreshed on every fetch since the user
   *  may sign in / out between calls but we don't want to spawn `gh` more
   *  than once per fetch cycle. */
  private async getGithubToken(): Promise<string | null> {
    const result = await execGh(["auth", "token"]);
    if (result.exitCode !== 0) return null;
    const token = result.stdout.trim();
    return token.length > 0 ? token : null;
  }

  private async ghFetch<T>(
    path: string,
    token: string | null,
  ): Promise<
    { ok: true; data: T } | { ok: false; status: number; body: string }
  > {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "posthog-code",
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${GH_API}${path}`, { headers });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, status: res.status, body };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  }

  /** Fetch a fresh summary for the given repo + config. Always returns a
   *  summary – on error, `error` is set and counts are zero. */
  public async fetchActivity(
    params: FetchActivityParams,
  ): Promise<GithubActivitySummary> {
    const { repo, enabledTypes, windowDays } = params;
    const fetchedAt = new Date().toISOString();
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const sinceMs = since.getTime();
    const repoPath = `/repos/${repo.owner}/${repo.name}`;

    const counts = emptyCounts();
    const items: GithubActivityItem[] = [];
    let latestRelease: GithubActivitySummary["latestRelease"];
    const typeSet = new Set(enabledTypes);

    // Reuse the same token PostHog Code uses elsewhere – the agent injects
    // it as GH_TOKEN, PR actions read it via `gh auth token`. Calling the
    // REST API directly with that token avoids the auth probe + per-request
    // subprocess spawn pattern, and lets public-repo fetches succeed even
    // when `gh` isn't installed at all.
    const token = await this.getGithubToken();

    try {
      if (typeSet.has("pr_merged")) {
        const merged = await this.ghFetch<RestPr[]>(
          `${repoPath}/pulls?state=closed&sort=updated&direction=desc&per_page=${PER_TYPE_LIMIT}`,
          token,
        );
        if (!merged.ok) throw this.toFetchError(merged, token);
        for (const pr of merged.data) {
          if (!pr.merged_at) continue;
          const when = pr.merged_at;
          if (new Date(when).getTime() < sinceMs) continue;
          counts.pr_merged += 1;
          items.push({
            id: `pr-merged-${pr.number}`,
            type: "pr_merged",
            title: pr.title,
            url: pr.html_url,
            actor: pr.user?.login ?? undefined,
            when,
          });
        }
      }

      if (typeSet.has("pr_opened")) {
        const opened = await this.ghFetch<RestPr[]>(
          `${repoPath}/pulls?state=open&sort=created&direction=desc&per_page=${PER_TYPE_LIMIT}`,
          token,
        );
        if (!opened.ok) throw this.toFetchError(opened, token);
        for (const pr of opened.data) {
          const when = pr.created_at;
          if (!when) continue;
          if (new Date(when).getTime() < sinceMs) continue;
          counts.pr_opened += 1;
          items.push({
            id: `pr-opened-${pr.number}`,
            type: "pr_opened",
            title: pr.title,
            url: pr.html_url,
            actor: pr.user?.login ?? undefined,
            when,
          });
        }
      }

      if (typeSet.has("issue_opened")) {
        const issues = await this.ghFetch<RestIssue[]>(
          `${repoPath}/issues?state=open&sort=created&direction=desc&per_page=${PER_TYPE_LIMIT}`,
          token,
        );
        if (!issues.ok) throw this.toFetchError(issues, token);
        for (const iss of issues.data) {
          // The /issues endpoint returns PRs too; filter them out.
          if (iss.pull_request) continue;
          const when = iss.created_at;
          if (!when) continue;
          if (new Date(when).getTime() < sinceMs) continue;
          counts.issue_opened += 1;
          items.push({
            id: `issue-${iss.number}`,
            type: "issue_opened",
            title: iss.title,
            url: iss.html_url,
            actor: iss.user?.login ?? undefined,
            when,
          });
        }
      }

      // Latest release: independent of the lookback window. Fetched only
      // when the user has the "release" type enabled. If the repo has no
      // releases yet, `latestRelease` stays undefined.
      if (typeSet.has("release")) {
        const releases = await this.ghFetch<RestRelease[]>(
          `${repoPath}/releases?per_page=1`,
          token,
        );
        if (!releases.ok) throw this.toFetchError(releases, token);
        const latest = releases.data[0];
        if (latest?.published_at) {
          latestRelease = {
            name: latest.name,
            tagName: latest.tag_name,
            url: latest.html_url,
            publishedAt: latest.published_at,
          };
        }
      }
    } catch (error) {
      log.warn("github activity fetch failed", {
        repo: `${repo.owner}/${repo.name}`,
        error,
      });
      const message =
        error instanceof Error ? error.message : "Failed to fetch activity";
      return {
        fetchedAt,
        windowDays,
        counts,
        latestRelease,
        recent: [],
        error: message,
      };
    }

    items.sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0));
    const recent = items.slice(0, RECENT_LIMIT);

    return { fetchedAt, windowDays, counts, latestRelease, recent };
  }

  /** Translate a non-2xx REST response into a friendly Error. 404s and 403s
   *  on private repos usually mean the user needs to authenticate. */
  private toFetchError(
    failure: { status: number; body: string },
    token: string | null,
  ): Error {
    if (failure.status === 404) {
      return new Error(
        token
          ? "Repository not found, or your GitHub token doesn't have access to it."
          : "Repository not found. If it's private, sign in to GitHub (run `gh auth login`) so PostHog Code can see it.",
      );
    }
    if (failure.status === 401 || failure.status === 403) {
      return new Error(
        token
          ? "GitHub rejected the request – your token may be expired or missing scope (re-run `gh auth login`)."
          : "GitHub rate limit hit for unauthenticated requests. Run `gh auth login` to use your account.",
      );
    }
    return new Error(
      `GitHub API ${failure.status}: ${failure.body.slice(0, 200)}`,
    );
  }
}
