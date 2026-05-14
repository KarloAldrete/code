import type { HomeRole } from "./store";

export const ROLES: Array<{
  value: HomeRole;
  label: string;
  description: string;
}> = [
  {
    value: "engineering",
    label: "Engineering",
    description: "Build the product.",
  },
  { value: "product", label: "Product", description: "Decide what to build." },
  { value: "design", label: "Design", description: "Make it great to use." },
  { value: "sales", label: "Sales", description: "Land and expand accounts." },
  {
    value: "marketing",
    label: "Marketing",
    description: "Drive awareness and demand.",
  },
  {
    value: "data",
    label: "Data / Analytics",
    description: "Make sense of the numbers.",
  },
  {
    value: "leadership",
    label: "Leadership",
    description: "Set direction and metrics.",
  },
  {
    value: "support",
    label: "Support / CS",
    description: "Help customers succeed.",
  },
  {
    value: "other",
    label: "Something else",
    description: "We'll keep it general.",
  },
];

/** Products available in the org. In real life this is gated by org usage. */
export const PRODUCTS: Array<{
  id: string;
  label: string;
  description: string;
  available: boolean;
}> = [
  {
    id: "product-analytics",
    label: "Product analytics",
    description: "Events, funnels, retention.",
    available: true,
  },
  {
    id: "web-analytics",
    label: "Web analytics",
    description: "Sessions, sources, page views.",
    available: true,
  },
  {
    id: "revenue-analytics",
    label: "Revenue analytics",
    description: "MRR, churn, expansion.",
    available: true,
  },
  {
    id: "experiments",
    label: "Experiments",
    description: "A/B tests with stats.",
    available: true,
  },
  {
    id: "feature-flags",
    label: "Feature flags",
    description: "Roll out features safely.",
    available: true,
  },
  {
    id: "session-replay",
    label: "Session replay",
    description: "Watch user sessions.",
    available: true,
  },
  {
    id: "surveys",
    label: "Surveys",
    description: "Collect user feedback.",
    available: true,
  },
  {
    id: "error-tracking",
    label: "Error tracking",
    description: "Capture exceptions.",
    available: true,
  },
  {
    id: "llm-analytics",
    label: "LLM analytics",
    description: "Track AI generations.",
    available: false,
  },
  {
    id: "data-warehouse",
    label: "Data warehouse",
    description: "Query Postgres, Stripe, etc.",
    available: false,
  },
];

export const USE_CASES: Array<{ id: string; label: string }> = [
  { id: "monitor-experiments", label: "Monitor active experiments" },
  { id: "top-customers", label: "Watch my top customers" },
  { id: "launch-tracking", label: "Track new feature launches" },
  { id: "activation", label: "Improve user activation" },
  { id: "conversion", label: "Optimize conversion" },
  { id: "churn", label: "Reduce churn" },
  { id: "errors", label: "Catch regressions early" },
  { id: "marketing-attribution", label: "Marketing attribution" },
  { id: "qualitative-feedback", label: "Listen to qualitative feedback" },
  { id: "onboarding", label: "Improve onboarding" },
  { id: "pricing", label: "Pricing decisions" },
  { id: "growth-experiments", label: "Run growth experiments" },
];
