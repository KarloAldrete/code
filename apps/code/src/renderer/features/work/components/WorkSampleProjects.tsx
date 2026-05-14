import {
  Bug,
  FilmReel,
  Flag,
  FunnelSimple,
  type IconProps,
  Newspaper,
  UserMinus,
} from "@phosphor-icons/react";
import { Box, Text } from "@radix-ui/themes";
import { useNavigationStore } from "@stores/navigationStore";
import { logger } from "@utils/logger";
import { toast } from "@utils/toast";
import { type ComponentType, useState } from "react";
import { createProject } from "../canvas/useProjectCanvas";

const log = logger.scope("work-sample-projects");

interface SampleProject {
  icon: ComponentType<IconProps>;
  title: string;
  description: string;
  prompt: string;
}

const PROJECTS: SampleProject[] = [
  {
    icon: Newspaper,
    title: "Monday brief",
    description: "What changed in the product last week",
    prompt:
      "Pull together a Monday brief: top product events that moved last week, notable user-behavior shifts, and anything that looks like a regression.",
  },
  {
    icon: FunnelSimple,
    title: "Funnel leaks",
    description: "Where users are quietly falling out",
    prompt:
      "Find the biggest drop-off points in our signup-to-activation funnel over the last 30 days and propose two hypotheses for each.",
  },
  {
    icon: UserMinus,
    title: "Churn radar",
    description: "Who used to be active and isn't anymore",
    prompt:
      "Identify users who were highly active in the last 60 days but have gone quiet in the last 14, and group them by what they were doing before.",
  },
  {
    icon: Flag,
    title: "Flag hygiene",
    description: "Stale or fully rolled-out flags safe to remove",
    prompt:
      "Audit our feature flags — which are stale, fully rolled out, or no longer being evaluated, and which look safe to delete?",
  },
  {
    icon: Bug,
    title: "Error triage",
    description: "Noisiest new errors this week",
    prompt:
      "Surface the noisiest new error tracking issues from the last 7 days, ranked by user impact, with a one-line root-cause guess for each.",
  },
  {
    icon: FilmReel,
    title: "Replay digest",
    description: "Three session replays worth watching",
    prompt:
      "Pick three representative session replays from the last 7 days that are worth me actually watching — one happy path, one friction moment, one weird outlier.",
  },
];

function SampleCard({
  project,
  onCreate,
  disabled,
}: {
  project: SampleProject;
  onCreate: (prompt: string) => void;
  disabled: boolean;
}) {
  const Icon = project.icon;
  return (
    <button
      type="button"
      onClick={() => onCreate(project.prompt)}
      disabled={disabled}
      className="group flex h-full flex-col items-start gap-1 rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1) p-3 text-left transition-colors hover:border-(--gray-7) hover:bg-(--gray-2) disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Box className="mb-1 text-(--gray-11) transition-colors group-hover:text-(--gray-12)">
        <Icon size={20} weight="duotone" />
      </Box>
      <Text as="div" weight="medium" className="text-(--gray-12) text-[13px]">
        {project.title}
      </Text>
      <Text as="div" className="text-(--gray-11) text-[12px] leading-snug">
        {project.description}
      </Text>
    </button>
  );
}

export function WorkSampleProjects() {
  const navigateToWorkProjectDetail = useNavigationStore(
    (s) => s.navigateToWorkProjectDetail,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (prompt: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const project = await createProject({ fromPrompt: prompt });
      navigateToWorkProjectDetail(project.id);
    } catch (error) {
      const description =
        error instanceof Error ? error.message : "Unknown error";
      toast.error("Could not start project", { description });
      log.error("Failed to create project from sample prompt", { error });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {PROJECTS.map((p) => (
        <SampleCard
          key={p.title}
          project={p}
          onCreate={handleCreate}
          disabled={isSubmitting}
        />
      ))}
    </Box>
  );
}
