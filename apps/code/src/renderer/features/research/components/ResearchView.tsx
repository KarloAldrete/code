import { DotPatternBackground } from "@components/DotPatternBackground";
import { ConnectorsMenu } from "@features/message-editor/components/ConnectorsMenu";
import { PromptInput } from "@features/message-editor/components/PromptInput";
import type { EditorHandle } from "@features/message-editor/types";
import { useSetHeaderContent } from "@hooks/useSetHeaderContent";
import {
  ArrowRight,
  ChartLineUp,
  CurrencyDollar,
  Detective,
  Funnel,
  Lock,
  MagnifyingGlass,
  Microscope,
  Path,
  Rocket,
} from "@phosphor-icons/react";
import { Flex, Heading, Text } from "@radix-ui/themes";
import { logger } from "@utils/logger";
import { toast } from "@utils/toast";
import type React from "react";
import { useCallback, useMemo, useRef } from "react";
import { useDragScroll } from "../hooks/useDragScroll";

const log = logger.scope("research-view");

interface ResearchSkill {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  prompt: string;
  /** When set, the card is shown locked and clicking surfaces the requirement. */
  lockedReason?: string;
}

const RESEARCH_SKILLS: ResearchSkill[] = [
  {
    id: "activation",
    title: "Activation research",
    description:
      "Figure out where new users get stuck before reaching their first key action and what unlocks them.",
    icon: <Rocket size={18} />,
    prompt: "Run activation research on my product",
  },
  {
    id: "mom-revenue-exploration",
    title: "MoM revenue exploration",
    description:
      "Break down month-over-month revenue movement — new MRR, expansion, contraction, and churn.",
    icon: <CurrencyDollar size={18} />,
    prompt: "Explore my month-over-month revenue",
    lockedReason: "Requires Stripe Connection or MCP",
  },
  {
    id: "conversion",
    title: "Conversion research",
    description: "Dig into what is driving conversion rate up or down.",
    icon: <ChartLineUp size={18} />,
    prompt: "Run conversion research on my key funnel",
  },
  {
    id: "flow-summarization",
    title: "Flow summarization",
    description:
      "Research what issues customers are running into during a flow in your product.",
    icon: <Path size={18} />,
    prompt: "Summarize what's happening in this flow",
  },
  {
    id: "churn-analysis",
    title: "Churn analysis",
    description:
      "Understand who is leaving, when they leave, and what they did right before churning.",
    icon: <Funnel size={18} />,
    prompt: "Analyze churn in my product",
  },
  {
    id: "power-user-research",
    title: "Power user research",
    description:
      "Identify your most engaged users, see what they have in common, and find what makes them stick.",
    icon: <Detective size={18} />,
    prompt: "Profile my power users",
  },
];

export function ResearchView() {
  const editorRef = useRef<EditorHandle>(null);
  const sessionId = "research-input";

  const headerContent = useMemo(
    () => (
      <Flex align="center" gap="2" className="w-full min-w-0">
        <MagnifyingGlass size={12} className="shrink-0 text-gray-10" />
        <Text
          className="truncate whitespace-nowrap font-medium text-[13px]"
          title="Research"
        >
          Research
        </Text>
      </Flex>
    ),
    [],
  );
  useSetHeaderContent(headerContent);

  const handleSubmit = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    log.info("Research requested", { prompt: trimmed });
    toast.info("Research coming soon", trimmed);
    editorRef.current?.clear();
  }, []);

  const handleSkillClick = useCallback((skill: ResearchSkill) => {
    if (skill.lockedReason) {
      log.info("Locked research skill clicked", { id: skill.id });
      toast.info(skill.title, skill.lockedReason);
      return;
    }
    log.info("Research skill selected", { id: skill.id });
    toast.info("Research coming soon", skill.prompt);
  }, []);

  const handleViewAll = useCallback(() => {
    log.info("View all research skills clicked");
    toast.info("All research skills coming soon");
  }, []);

  return (
    <Flex
      align="center"
      justify="center"
      height="100%"
      className="relative px-4 py-8"
      overflow="auto"
    >
      <DotPatternBackground className="h-[100.333%]" />
      <Flex
        direction="column"
        gap="5"
        className="relative z-1 w-full max-w-190"
      >
        <Flex direction="column" gap="2">
          <Flex
            align="center"
            justify="center"
            className="h-10 w-10 rounded-full bg-(--iris-3) text-(--iris-11)"
          >
            <Microscope size={20} weight="duotone" />
          </Flex>
          <Heading size="4" className="text-(--gray-12)">
            Research
          </Heading>
          <Text size="2" color="gray">
            Better understand what's going on in your product and derive
            insights for better decision making.
          </Text>
        </Flex>

        <PromptInput
          ref={editorRef}
          sessionId={sessionId}
          placeholder="What do you want to research?"
          editorHeight="large"
          autoFocus
          clearOnSubmit={false}
          onSubmit={handleSubmit}
          connectorsSlot={<ConnectorsMenu />}
        />

        <Flex direction="column" gap="3">
          <Flex align="center" justify="between">
            <Text size="2" weight="medium" className="text-(--gray-12)">
              Research skills
            </Text>
            <button
              type="button"
              onClick={handleViewAll}
              className="flex items-center gap-1 text-(--accent-11) text-[13px] hover:underline"
            >
              View all research skills
              <ArrowRight size={12} />
            </button>
          </Flex>

          <DragScrollRow>
            {RESEARCH_SKILLS.map((skill) => (
              <ResearchSkillCard
                key={skill.id}
                skill={skill}
                onClick={() => handleSkillClick(skill)}
              />
            ))}
          </DragScrollRow>
        </Flex>
      </Flex>
    </Flex>
  );
}

function DragScrollRow({ children }: { children: React.ReactNode }) {
  const ref = useDragScroll<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="-mx-4 cursor-grab overflow-x-auto overflow-y-hidden px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <Flex gap="3" className="w-max">
        {children}
      </Flex>
    </div>
  );
}

function ResearchSkillCard({
  skill,
  onClick,
}: {
  skill: ResearchSkill;
  onClick: () => void;
}) {
  const locked = !!skill.lockedReason;
  return (
    <button
      type="button"
      onClick={onClick}
      title={locked ? skill.lockedReason : undefined}
      className={`group flex h-56 w-56 shrink-0 flex-col gap-1.5 overflow-hidden rounded-(--radius-3) border border-(--gray-5) p-5 text-left transition-all ${
        locked
          ? "bg-(--gray-2) hover:border-(--gray-7)"
          : "bg-(--gray-1) hover:border-(--accent-7) hover:bg-(--gray-2)"
      }`}
    >
      <Flex
        align="center"
        justify="center"
        className={`mb-1 h-8 w-8 shrink-0 rounded-(--radius-2) ${
          locked
            ? "bg-(--gray-3) text-(--gray-10)"
            : "bg-(--accent-3) text-(--accent-11)"
        }`}
      >
        {skill.icon}
      </Flex>
      <Text
        size="2"
        weight="medium"
        className={locked ? "text-(--gray-11)" : "text-(--gray-12)"}
      >
        {skill.title}
      </Text>
      <Text size="1" className="line-clamp-3 text-(--gray-11)">
        {skill.description}
      </Text>
      {locked && (
        <span className="inline-flex w-fit items-center gap-1 rounded-(--radius-1) bg-(--gray-3) px-1.5 py-0.5 font-medium text-(--gray-10) text-[10px] uppercase tracking-wide">
          <Lock size={9} weight="fill" />
          {skill.lockedReason}
        </span>
      )}
    </button>
  );
}
