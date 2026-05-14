import {
  ChartBar,
  ChartPieSlice,
  ChatCircleText,
  CurrencyDollar,
  Flag,
  Funnel,
  type Icon,
  Megaphone,
  RocketLaunch,
  TestTube,
  UsersThree,
} from "@phosphor-icons/react";

export interface HomeAppEntry {
  id: string;
  name: string;
  description: string;
  icon: Icon;
  /** Tailwind classes for the icon tile (bg + text color). */
  color: string;
}

export const HOME_APPS: HomeAppEntry[] = [
  {
    id: "experiments",
    name: "Experiments",
    description: "A/B tests with built-in stats.",
    icon: TestTube,
    color: "bg-(--purple-3) text-(--purple-11)",
  },
  {
    id: "revenue-analytics",
    name: "Revenue analytics",
    description: "MRR, churn, expansion.",
    icon: CurrencyDollar,
    color: "bg-(--grass-3) text-(--grass-11)",
  },
  {
    id: "customer-analytics",
    name: "Customer analytics",
    description: "Account-level health and usage.",
    icon: UsersThree,
    color: "bg-(--cyan-3) text-(--cyan-11)",
  },
  {
    id: "product-analytics",
    name: "Product analytics",
    description: "Trends, funnels, retention.",
    icon: ChartBar,
    color: "bg-(--blue-3) text-(--blue-11)",
  },
  {
    id: "feature-flags",
    name: "Feature flags",
    description: "Roll out features safely.",
    icon: Flag,
    color: "bg-(--green-3) text-(--green-11)",
  },
  {
    id: "surveys",
    name: "Surveys",
    description: "In-product feedback.",
    icon: ChatCircleText,
    color: "bg-(--blue-3) text-(--blue-11)",
  },
];

export interface HomeCanvasEntry {
  id: string;
  name: string;
  description: string;
  icon: Icon;
  color: string;
}

/** Placeholder example canvases — not backed by real PostHog data. */
export const HOME_CANVASES: HomeCanvasEntry[] = [
  {
    id: "top-customer-renewals",
    name: "Top customer renewals",
    description: "Renewal pipeline by ARR.",
    icon: CurrencyDollar,
    color: "bg-(--grass-3) text-(--grass-11)",
  },
  {
    id: "experiments-overview",
    name: "Experiments overview",
    description: "Running tests + last 30 days.",
    icon: TestTube,
    color: "bg-(--purple-3) text-(--purple-11)",
  },
  {
    id: "onboarding-funnel",
    name: "Onboarding funnel deep-dive",
    description: "Step-by-step + drop-off reasons.",
    icon: Funnel,
    color: "bg-(--orange-3) text-(--orange-11)",
  },
  {
    id: "q4-board-review",
    name: "Q4 board review",
    description: "Headline metrics for the deck.",
    icon: ChartPieSlice,
    color: "bg-(--iris-3) text-(--iris-11)",
  },
  {
    id: "marketing-attribution",
    name: "Marketing attribution",
    description: "Channels driving signups + ARR.",
    icon: Megaphone,
    color: "bg-(--pink-3) text-(--pink-11)",
  },
  {
    id: "feature-launch-radar",
    name: "Feature launch radar",
    description: "Adoption for last 4 launches.",
    icon: RocketLaunch,
    color: "bg-(--tomato-3) text-(--tomato-11)",
  },
];
