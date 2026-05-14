import type { Tile, WorkProject } from "@shared/types/work-projects";

const NOW = new Date("2026-05-13T12:00:00.000Z").toISOString();

function tile<T extends Tile>(t: T): T {
  return t;
}

const launchTiles: Tile[] = [
  tile({
    id: "seed-launch-title",
    type: "title",
    size: "full",
    state: "live",
    origin: "seed",
    iconId: "rocket",
    name: "PostHog Code launch",
    tagline: "Launch week",
  }),
  tile({
    id: "seed-launch-headline",
    type: "headline",
    size: "md",
    state: "live",
    origin: "seed",
    label: "Waitlist signups · last 14 days",
    liveLabel: "Daily signups · last 14 days",
    fallbackValue: "1,548",
    fallbackDelta: "+19× vs. prior 7 days",
    fallbackSparkline: [
      13, 19, 9, 4, 5, 11, 1136, 469, 163, 77, 49, 34, 51, 303, 402,
    ],
    posthogUrl: "https://us.posthog.com/project/2/insights/8N93qeGt",
    query: {
      posthogProjectId: 2,
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
  }),
  tile({
    id: "seed-launch-insight",
    type: "insight",
    size: "md",
    state: "live",
    origin: "seed",
    posthogProjectId: 2,
    dashboardId: 1541474,
    title: "Launch monitoring",
    description:
      "Seats, usage, Stripe quantities, and invoice lines from launch cutoff.",
    owner: "Pawel",
    url: "https://us.posthog.com/project/2/dashboard/1541474",
  }),
  tile({
    id: "seed-launch-file",
    type: "file",
    size: "md",
    state: "live",
    origin: "seed",
    filename: "Launch plan.md",
    contents:
      "# Launch plan\n\n- Waitlist conversion ramp\n- ICP outreach\n- Feedback monitoring\n- Billing health\n",
  }),
  tile({
    id: "seed-launch-skill",
    type: "skill_output",
    size: "md",
    state: "live",
    origin: "seed",
    skillName: "Important Slack threads",
    skillDescription: "Surfaces threads that mention #posthog-code-launch.",
    lastRunOutput:
      "- @charles asked about the hackathon scoring rubric\n- @cleo flagged ICP copy needs refresh before tomorrow's send\n- @andy noted Stripe invoice line items still show beta plan",
    lastRunAt: NOW,
  }),
  tile({
    id: "seed-launch-note",
    type: "note",
    size: "sm",
    state: "live",
    origin: "seed",
    body: "Chase down the Stripe invoice line item discrepancy before Friday's send.",
    tone: "yellow",
  }),
];

const voiceTiles: Tile[] = [
  tile({
    id: "seed-voice-title",
    type: "title",
    size: "full",
    state: "live",
    origin: "seed",
    iconId: "microphone",
    name: "Voice of customer",
    tagline: "Q2 interviews",
  }),
  tile({
    id: "seed-voice-skill",
    type: "skill_output",
    size: "md",
    state: "live",
    origin: "seed",
    skillName: "Power user discovery",
    skillDescription: "Clusters frequent users by feature surface and value.",
    lastRunOutput:
      "- 12 power users on Insights (median 4 sessions / week)\n- 7 power users on Replay (median 9 recordings / day)\n- 5 power users on Surveys, all running 3+ active surveys",
    lastRunAt: NOW,
  }),
  tile({
    id: "seed-voice-insight",
    type: "insight",
    size: "md",
    state: "live",
    origin: "seed",
    posthogProjectId: 2,
    dashboardId: 1312087,
    title: "Live feedback feed",
    description: "/good, /bad, /feedback from inside PostHog Code.",
    owner: "Andy M",
    url: "https://us.posthog.com/project/2/dashboard/1312087",
  }),
  tile({
    id: "seed-voice-file",
    type: "file",
    size: "md",
    state: "live",
    origin: "seed",
    filename: "Interview themes.md",
    contents:
      "# Interview themes\n\n## Themes\n\n- Onboarding friction at install step\n- Wants per-project memory in chat\n- Asks for shareable canvases\n",
  }),
  tile({
    id: "seed-voice-note",
    type: "note",
    size: "sm",
    state: "live",
    origin: "seed",
    body: "Schedule three more interviews with replay-heavy users next week.",
    tone: "blue",
  }),
];

const growthTiles: Tile[] = [
  tile({
    id: "seed-growth-title",
    type: "title",
    size: "full",
    state: "live",
    origin: "seed",
    iconId: "lightbulb",
    name: "Growth experiments",
    tagline: "Activation",
  }),
  tile({
    id: "seed-growth-headline",
    type: "headline",
    size: "md",
    state: "live",
    origin: "seed",
    label: "Activation rate · last 14 days",
    fallbackValue: "31%",
    fallbackDelta: "+2.1pp vs. prior 14 days",
    fallbackSparkline: [28, 30, 27, 31, 29, 32, 33, 31, 30, 32, 34, 33, 31, 32],
  }),
  tile({
    id: "seed-growth-insight",
    type: "insight",
    size: "md",
    state: "live",
    origin: "seed",
    posthogProjectId: 2,
    dashboardId: 1472805,
    title: "ICP target segments",
    description: "Three org segments that look like strong fits.",
    owner: "Cleo",
    url: "https://us.posthog.com/project/2/dashboard/1472805",
  }),
  tile({
    id: "seed-growth-skill",
    type: "skill_output",
    size: "md",
    state: "live",
    origin: "seed",
    skillName: "Product-market fit tracker",
    skillDescription: "Tracks PMF survey responses week-over-week.",
    lastRunOutput:
      "Very disappointed: 48% (n=212). Up 3pp vs last week. ICE score on onboarding flow ties closely with first-week retention.",
    lastRunAt: NOW,
  }),
  tile({
    id: "seed-growth-note",
    type: "note",
    size: "sm",
    state: "live",
    origin: "seed",
    body: "Hypothesis: invite-during-onboarding bumps 7d retention. Worth a test next sprint.",
    tone: "green",
  }),
];

export const SEED_PROJECTS: WorkProject[] = [
  {
    id: "posthog-code-launch",
    name: "PostHog Code launch",
    tagline: "Launch week",
    iconId: "rocket",
    members: [
      { name: "Cleo Lant", initials: "CL" },
      { name: "Andy Vandervell", initials: "AV" },
      { name: "Andy Maguire", initials: "AM" },
      { name: "Pawel Cebula", initials: "PC" },
    ],
    tiles: launchTiles,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "voice-of-customer",
    name: "Voice of customer",
    tagline: "Q2 interviews",
    iconId: "microphone",
    members: [
      { name: "Cleo Lant", initials: "CL" },
      { name: "Andy Vandervell", initials: "AV" },
    ],
    tiles: voiceTiles,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: "growth-experiments",
    name: "Growth experiments",
    tagline: "Activation",
    iconId: "lightbulb",
    members: [{ name: "Cleo Lant", initials: "CL" }],
    tiles: growthTiles,
    createdAt: NOW,
    updatedAt: NOW,
  },
];
