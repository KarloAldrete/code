/**
 * Demo project data. The "posthog-code-launch" entry is anchored on real
 * PostHog Cloud dashboards in project 2 – IDs, names and recent counts were
 * pulled live via the PostHog MCP. The other two are placeholders.
 */

import type { ProjectIconId } from "./projectIcons";

export interface ProjectDashboardRef {
  id: number;
  name: string;
  description: string;
  url: string;
  owner: string;
}

export interface ProjectAutomation {
  id: string;
  title: string;
  schedule: string;
  description: string;
  enabled: boolean;
}

export interface ProjectFile {
  id: string;
  name: string;
  updatedLabel: string;
}

export interface ProjectActivityEntry {
  id: string;
  kind:
    | "commit"
    | "pr_opened"
    | "pr_merged"
    | "issue_opened"
    | "issue_closed"
    | "release";
  text: string;
  when: string;
  actor?: string;
  url?: string;
}

export interface ProjectGitHubRepo {
  owner: string;
  name: string;
  url: string;
  /** Aggregated counts across the activity window (last 24h). */
  summary?: {
    prsMerged?: number;
    prsOpened?: number;
    commits?: number;
    issuesOpened?: number;
    releases?: number;
  };
}

export interface ProjectHeadlineStat {
  label: string;
  value: string;
  delta: string;
  sparkline: number[];
  posthogUrl: string;
  /**
   * Optional live PostHog query that overrides the static value/delta/sparkline
   * when authenticated. Shape matches the body PostHog's `/query/` endpoint
   * accepts (e.g. a TrendsQuery node).
   */
  query?: {
    posthogProjectId: number;
    body: Record<string, unknown>;
    /** Render label, e.g. "Daily signups · last 14 days". */
    displayLabel?: string;
  };
}

export interface ProjectMember {
  name: string;
  initials: string;
}

export interface Project {
  id: string;
  name: string;
  iconId: ProjectIconId;
  tagline: string;
  description: string;
  updatedLabel: string;
  members: ProjectMember[];
  isPlaceholder?: boolean;
  headline?: ProjectHeadlineStat;
  dashboards?: ProjectDashboardRef[];
  automations?: ProjectAutomation[];
  files?: ProjectFile[];
  activity?: ProjectActivityEntry[];
  githubRepo?: ProjectGitHubRepo;
  pinnedSkills?: string[];
}

export const PROJECTS: Project[] = [
  {
    id: "posthog-code-launch",
    name: "PostHog Code launch",
    iconId: "rocket",
    tagline: "Launch week",
    description:
      "Coordinated launch of PostHog Code – waitlist conversion, ICP targeting, feedback monitoring, and billing health.",
    updatedLabel: "Updated just now",
    members: [
      { name: "Cleo Lant", initials: "CL" },
      { name: "Andy Vandervell", initials: "AV" },
      { name: "Andy Maguire", initials: "AM" },
      { name: "Pawel Cebula", initials: "PC" },
    ],
    headline: {
      label: "Waitlist signups · last 14 days",
      value: "1,548",
      delta: "+19× vs. prior 7 days",
      // Static fallback used pre-auth or while the live query is loading.
      // Real daily counts pulled from PostHog (event subscribe_to_product_updates,
      // $pathname=/code, last 14 days, ending 2026-05-13).
      sparkline: [
        13, 19, 9, 4, 5, 11, 1136, 469, 163, 77, 49, 34, 51, 303, 402,
      ],
      posthogUrl: "https://us.posthog.com/project/2/insights/8N93qeGt",
      query: {
        posthogProjectId: 2,
        displayLabel: "Daily signups · last 14 days",
        // Mirrors the saved insight "Waitlist signups over time" (8N93qeGt)
        // on dashboard 1550313, but resampled daily over 14 days so the
        // headline reflects launch-week momentum.
        body: {
          kind: "TrendsQuery",
          series: [
            {
              kind: "EventsNode",
              math: "total",
              event: "subscribe_to_product_updates",
              properties: [
                {
                  key: "$pathname",
                  type: "event",
                  value: "/code",
                  operator: "exact",
                },
              ],
              custom_name: "Signups",
            },
          ],
          interval: "day",
          dateRange: { date_from: "-14d", explicitDate: false },
          trendsFilter: { display: "ActionsBar" },
          filterTestAccounts: true,
        },
      },
    },
    dashboards: [
      {
        id: 1550313,
        name: "PostHog Code waitlist analysis",
        description:
          "Signups, conversion rate, traffic sources, and geo reach for posthog.com/code.",
        url: "https://us.posthog.com/project/2/dashboard/1550313",
        owner: "Andy V",
      },
      {
        id: 1472805,
        name: "PostHog Code ICP targets",
        description:
          "Three org segments that look like strong fits – small teams, error-tracking users, YC cohort.",
        url: "https://us.posthog.com/project/2/dashboard/1472805",
        owner: "Cleo",
      },
      {
        id: 1541474,
        name: "PostHog Code launch monitoring",
        description:
          "Seats, usage, Stripe quantities, and invoice lines from launch cutoff onward.",
        url: "https://us.posthog.com/project/2/dashboard/1541474",
        owner: "Pawel",
      },
      {
        id: 1312087,
        name: "PostHog Code feedback",
        description:
          "Live feed of /good, /bad, /feedback commands from inside PostHog Code.",
        url: "https://us.posthog.com/project/2/dashboard/1312087",
        owner: "Andy M",
      },
      {
        id: 1580654,
        name: "PostHog Code hackathon leaderboard",
        description:
          "Live leaderboard of AI spend per @posthog.com user during the launch-week hackathon.",
        url: "https://us.posthog.com/project/2/dashboard/1580654",
        owner: "Adam",
      },
    ],
    automations: [
      {
        id: "auto-waitlist-digest",
        title: "Daily waitlist digest",
        schedule: "Weekdays · 9:00am PT",
        description:
          "Posts yesterday's signups, top referring domains, and notable spikes to #posthog-code-launch.",
        enabled: true,
      },
      {
        id: "auto-conversion-alert",
        title: "Conversion-rate alert",
        schedule: "Hourly check",
        description:
          "Pings me if visit → waitlist conversion drops more than 30% week-over-week.",
        enabled: true,
      },
      {
        id: "auto-feedback-summary",
        title: "Friday feedback recap",
        schedule: "Fridays · 4:00pm PT",
        description:
          "Clusters /good, /bad, /feedback events from PostHog Code into themes and surfaces top 3.",
        enabled: false,
      },
    ],
    files: [
      {
        id: "f-launch-plan",
        name: "Launch plan.md",
        updatedLabel: "Yesterday",
      },
      {
        id: "f-icp-draft",
        name: "ICP segments draft.md",
        updatedLabel: "3 days ago",
      },
      {
        id: "f-hackathon-readme",
        name: "Hackathon README.md",
        updatedLabel: "Today",
      },
    ],
    githubRepo: {
      owner: "PostHog",
      name: "code",
      url: "https://github.com/PostHog/code",
      summary: {
        prsMerged: 5,
        prsOpened: 7,
        commits: 23,
        issuesOpened: 4,
        releases: 1,
      },
    },
    activity: [
      {
        id: "gh-1",
        kind: "pr_merged",
        text: "fix(work): point New task at Work home, remove redundant Home item",
        when: "2h ago",
        actor: "charlescook",
        url: "https://github.com/PostHog/code/pull/2148",
      },
      {
        id: "gh-2",
        kind: "release",
        text: "v0.42.0 – Work mode projects, Chat mode for quick model conversations",
        when: "5h ago",
        actor: "github-actions",
        url: "https://github.com/PostHog/code/releases/tag/v0.42.0",
      },
      {
        id: "gh-3",
        kind: "pr_opened",
        text: "feat(work): project chat panel with live PostHog insight",
        when: "7h ago",
        actor: "cleo-pleurodon",
        url: "https://github.com/PostHog/code/pull/2150",
      },
      {
        id: "gh-4",
        kind: "pr_merged",
        text: "feat(work): scheduled tasks under Work mode",
        when: "11h ago",
        actor: "andyvandervell",
        url: "https://github.com/PostHog/code/pull/2134",
      },
      {
        id: "gh-5",
        kind: "issue_opened",
        text: "Waitlist landing copy needs ICP segment refresh before tomorrow's send",
        when: "16h ago",
        actor: "andymaguire",
        url: "https://github.com/PostHog/code/issues/2156",
      },
    ],
    pinnedSkills: ["Marketing campaign digest", "Slack standup recap"],
  },
  {
    id: "customer-interviews-q2",
    name: "Customer interview synthesis",
    iconId: "microphone",
    tagline: "Q2 interviews",
    description:
      "Q2 customer conversations clustered into recurring themes, with linked transcripts and follow-ups.",
    updatedLabel: "Updated 2 days ago",
    members: [
      { name: "Cleo Lant", initials: "CL" },
      { name: "Andy Vandervell", initials: "AV" },
    ],
    isPlaceholder: true,
  },
  {
    id: "q3-marketing",
    name: "Q3 marketing campaigns",
    iconId: "megaphone",
    tagline: "Planning",
    description:
      "Cross-channel campaign plan for Q3 – owned dashboards, briefs, and the rollout calendar.",
    updatedLabel: "Updated 1 week ago",
    members: [{ name: "Cleo Lant", initials: "CL" }],
    isPlaceholder: true,
  },
];

export function getProject(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}
