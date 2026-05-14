import { useSetHeaderContent } from "@hooks/useSetHeaderContent";
import {
  Brain,
  Bug,
  ChartBar,
  ChartLineUp,
  ChartPieSlice,
  ChatCircleText,
  Clock,
  Code,
  CurrencyDollar,
  Database,
  Flag,
  FlowArrow,
  Globe,
  GraphIcon,
  Hammer,
  Heart,
  type Icon,
  Lightning,
  ListChecks,
  Megaphone,
  Notebook,
  Path,
  Plus,
  ShoppingCart,
  Sparkle,
  SquaresFour,
  Star,
  Table as TableIcon,
  TestTube,
  Toolbox,
  TreasureChest,
  UsersThree,
  VideoCamera,
  Wrench,
} from "@phosphor-icons/react";
import { Box, Flex, Text } from "@radix-ui/themes";
import { useMemo } from "react";

type AppColor =
  | "blue"
  | "iris"
  | "violet"
  | "purple"
  | "pink"
  | "crimson"
  | "ruby"
  | "tomato"
  | "orange"
  | "amber"
  | "yellow"
  | "grass"
  | "green"
  | "teal"
  | "cyan"
  | "gray";

interface AppEntry {
  id: string;
  name: string;
  description: string;
  icon: Icon;
  color: AppColor;
}

interface AppCategory {
  id: string;
  title: string;
  apps: AppEntry[];
}

const CATEGORIES: AppCategory[] = [
  {
    id: "analytics",
    title: "Analytics",
    apps: [
      {
        id: "product-analytics",
        name: "Product analytics",
        description: "Trends, funnels, retention, paths, and stickiness.",
        icon: ChartBar,
        color: "blue",
      },
      {
        id: "web-analytics",
        name: "Web analytics",
        description: "Page views, sessions, bounce rates, top sources.",
        icon: Globe,
        color: "green",
      },
      {
        id: "revenue-analytics",
        name: "Revenue analytics",
        description: "MRR, churn, expansion, and revenue cohorts.",
        icon: CurrencyDollar,
        color: "grass",
      },
      {
        id: "customer-analytics",
        name: "Customer analytics",
        description: "Account-level health, usage, and lifecycle.",
        icon: UsersThree,
        color: "cyan",
      },
      {
        id: "marketing-analytics",
        name: "Marketing analytics",
        description: "Attribution, campaign performance, channel mix.",
        icon: Megaphone,
        color: "pink",
      },
      {
        id: "dashboards",
        name: "Dashboards",
        description: "Pin and share the metrics that matter.",
        icon: SquaresFour,
        color: "orange",
      },
      {
        id: "sql-editor",
        name: "SQL editor",
        description: "Run HogQL against events, persons, and the warehouse.",
        icon: TableIcon,
        color: "purple",
      },
    ],
  },
  {
    id: "behavior",
    title: "Behavior",
    apps: [
      {
        id: "session-replay",
        name: "Session replay",
        description: "Watch what users actually do, frame by frame.",
        icon: VideoCamera,
        color: "tomato",
      },
      {
        id: "heatmaps",
        name: "Heatmaps",
        description: "Clicks, scrolls, and rage on top of your own pages.",
        icon: ChartPieSlice,
        color: "ruby",
      },
      {
        id: "user-paths",
        name: "User paths",
        description: "See where users came from and what they did next.",
        icon: Path,
        color: "iris",
      },
      {
        id: "cohorts",
        name: "Cohorts",
        description: "Behavioral and property-based user segments.",
        icon: UsersThree,
        color: "teal",
      },
      {
        id: "notebooks",
        name: "Notebooks",
        description: "Combine queries, replays, and notes into one doc.",
        icon: Notebook,
        color: "gray",
      },
    ],
  },
  {
    id: "experimentation",
    title: "Experimentation",
    apps: [
      {
        id: "feature-flags",
        name: "Feature flags",
        description: "Roll out features safely with targeted rules.",
        icon: Flag,
        color: "green",
      },
      {
        id: "experiments",
        name: "Experiments",
        description: "Run A/B tests with built-in stats.",
        icon: TestTube,
        color: "purple",
      },
      {
        id: "surveys",
        name: "Surveys",
        description: "In-product NPS, CSAT, and open-ended feedback.",
        icon: ChatCircleText,
        color: "blue",
      },
      {
        id: "early-access",
        name: "Early access features",
        description: "Let users opt in to features you're testing.",
        icon: Sparkle,
        color: "amber",
      },
    ],
  },
  {
    id: "ai-engineering",
    title: "AI engineering",
    apps: [
      {
        id: "llm-analytics",
        name: "LLM analytics",
        description: "Cost, latency, and quality across every generation.",
        icon: Brain,
        color: "violet",
      },
      {
        id: "evaluations",
        name: "Evaluations",
        description: "Score AI outputs with Hog or LLM-judge rubrics.",
        icon: ListChecks,
        color: "iris",
      },
      {
        id: "playground",
        name: "Playground",
        description: "Test prompts and models side-by-side.",
        icon: Lightning,
        color: "purple",
      },
      {
        id: "prompts",
        name: "Prompts",
        description: "Versioned prompts you can reference in code.",
        icon: Sparkle,
        color: "orange",
      },
      {
        id: "skills",
        name: "Skills",
        description: "Reusable agent skills with prompts and tools.",
        icon: Star,
        color: "yellow",
      },
      {
        id: "clusters",
        name: "Clusters",
        description: "Find patterns in LLM traces or session replays.",
        icon: GraphIcon,
        color: "blue",
      },
    ],
  },
  {
    id: "monitoring",
    title: "Monitoring",
    apps: [
      {
        id: "error-tracking",
        name: "Error tracking",
        description: "Capture exceptions with stack traces and replays.",
        icon: Bug,
        color: "amber",
      },
      {
        id: "logs",
        name: "Logs",
        description: "Search application logs alongside events and traces.",
        icon: Clock,
        color: "gray",
      },
      {
        id: "alerts",
        name: "Alerts",
        description: "Get pinged on anomalies in metrics you care about.",
        icon: Heart,
        color: "crimson",
      },
    ],
  },
  {
    id: "data",
    title: "Data",
    apps: [
      {
        id: "data-warehouse",
        name: "Data warehouse",
        description: "Query Postgres, BigQuery, Snowflake, and S3 in HogQL.",
        icon: Database,
        color: "purple",
      },
      {
        id: "data-pipelines",
        name: "Data pipelines",
        description: "Sources, transformations, and destinations.",
        icon: FlowArrow,
        color: "iris",
      },
      {
        id: "live-events",
        name: "Live events",
        description: "Watch raw events stream in as they're captured.",
        icon: Lightning,
        color: "yellow",
      },
      {
        id: "activity-log",
        name: "Activity log",
        description: "Audit changes to project entities over time.",
        icon: Clock,
        color: "gray",
      },
      {
        id: "annotations",
        name: "Annotations",
        description: "Mark deploys, launches, and incidents on charts.",
        icon: Plus,
        color: "teal",
      },
    ],
  },
  {
    id: "growth",
    title: "Growth",
    apps: [
      {
        id: "max",
        name: "Max AI",
        description: "Conversational analyst for your PostHog data.",
        icon: Sparkle,
        color: "purple",
      },
      {
        id: "actions",
        name: "Actions",
        description: "Group events into reusable named behaviors.",
        icon: Lightning,
        color: "yellow",
      },
      {
        id: "trends",
        name: "Trends",
        description: "Time-series charts for any metric, any breakdown.",
        icon: ChartLineUp,
        color: "blue",
      },
      {
        id: "funnels",
        name: "Funnels",
        description: "Step-by-step conversion with drop-off analysis.",
        icon: TreasureChest,
        color: "amber",
      },
      {
        id: "checkout-tracking",
        name: "Checkout tracking",
        description: "Pre-built funnels for ecommerce conversion.",
        icon: ShoppingCart,
        color: "tomato",
      },
    ],
  },
  {
    id: "engineering",
    title: "Engineering",
    apps: [
      {
        id: "sdks",
        name: "SDKs",
        description: "Drop-in clients for web, mobile, and server.",
        icon: Code,
        color: "gray",
      },
      {
        id: "toolbar",
        name: "Toolbar",
        description: "Authoring overlay for your live site.",
        icon: Wrench,
        color: "purple",
      },
      {
        id: "code",
        name: "PostHog Code",
        description: "Desktop app for building with AI agents.",
        icon: Hammer,
        color: "orange",
      },
      {
        id: "feature-success",
        name: "Feature success",
        description: "Did the launch actually move the metric?",
        icon: Toolbox,
        color: "iris",
      },
    ],
  },
];

const COLOR_BG: Record<AppColor, string> = {
  blue: "bg-(--blue-3) text-(--blue-11)",
  iris: "bg-(--iris-3) text-(--iris-11)",
  violet: "bg-(--violet-3) text-(--violet-11)",
  purple: "bg-(--purple-3) text-(--purple-11)",
  pink: "bg-(--pink-3) text-(--pink-11)",
  crimson: "bg-(--crimson-3) text-(--crimson-11)",
  ruby: "bg-(--ruby-3) text-(--ruby-11)",
  tomato: "bg-(--tomato-3) text-(--tomato-11)",
  orange: "bg-(--orange-3) text-(--orange-11)",
  amber: "bg-(--amber-3) text-(--amber-11)",
  yellow: "bg-(--yellow-3) text-(--yellow-11)",
  grass: "bg-(--grass-3) text-(--grass-11)",
  green: "bg-(--green-3) text-(--green-11)",
  teal: "bg-(--teal-3) text-(--teal-11)",
  cyan: "bg-(--cyan-3) text-(--cyan-11)",
  gray: "bg-(--gray-3) text-(--gray-11)",
};

export function AppsView() {
  const headerContent = useMemo(
    () => (
      <Flex align="center" gap="2" className="w-full min-w-0">
        <SquaresFour size={12} className="shrink-0 text-gray-10" />
        <Text
          className="truncate whitespace-nowrap font-medium text-[13px]"
          title="Apps"
        >
          Apps
        </Text>
      </Flex>
    ),
    [],
  );
  useSetHeaderContent(headerContent);

  return (
    <Flex direction="column" height="100%" className="overflow-hidden">
      <Box px="6" py="5" className="shrink-0 border-gray-6 border-b">
        <Text as="div" size="4" weight="medium">
          Apps
        </Text>
        <Text as="div" size="2" className="text-(--gray-11)">
          Everything PostHog offers — pick what you need to build, monitor, and
          understand your product.
        </Text>
      </Box>

      <Box flexGrow="1" overflow="auto">
        <Flex direction="column" gap="6" px="6" py="6">
          {CATEGORIES.map((category) => (
            <Box key={category.id}>
              <Text
                size="1"
                weight="medium"
                className="block text-(--gray-11) uppercase tracking-wide"
              >
                {category.title}
              </Text>
              <Box className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {category.apps.map((app) => (
                  <AppCard key={app.id} app={app} />
                ))}
              </Box>
            </Box>
          ))}
        </Flex>
      </Box>
    </Flex>
  );
}

function AppCard({ app }: { app: AppEntry }) {
  const Icon = app.icon;
  return (
    <button
      type="button"
      onClick={() => undefined}
      className="group flex items-start gap-3 rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1) p-3 text-left transition-all hover:border-(--accent-7) hover:bg-(--gray-2)"
    >
      <Flex
        align="center"
        justify="center"
        className={`h-9 w-9 shrink-0 rounded-(--radius-2) ${COLOR_BG[app.color]}`}
      >
        <Icon size={18} />
      </Flex>
      <Flex direction="column" gap="1" className="min-w-0 flex-1">
        <Text size="2" weight="medium" className="text-(--gray-12)">
          {app.name}
        </Text>
        <Text size="1" className="text-(--gray-11)">
          {app.description}
        </Text>
      </Flex>
    </button>
  );
}
