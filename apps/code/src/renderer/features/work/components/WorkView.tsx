import { WorkSuggestionsHoverCard } from "@features/sessions/components/WorkSuggestionsHoverCard";
import { Box, Flex, Text } from "@radix-ui/themes";
import hackerHog from "@renderer/assets/images/hedgehogs/hacker-hog.png";
import { useNavigationStore } from "@stores/navigationStore";
import { WorkGenerateView } from "./WorkGenerateView";
import { WorkSkillDetailView } from "./WorkSkillDetailView";

export function WorkView() {
  const workView = useNavigationStore((s) => s.workView);
  const workOnboardingSkipped = useNavigationStore(
    (s) => s.workOnboardingSkipped,
  );
  const skipWorkOnboarding = useNavigationStore((s) => s.skipWorkOnboarding);

  if (workView === "generate") {
    return <WorkGenerateView />;
  }

  if (workView === "skill-detail") {
    return <WorkSkillDetailView />;
  }

  if (workOnboardingSkipped) {
    return <Box className="h-full w-full" />;
  }

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      className="h-full w-full"
      gap="3"
    >
      <img
        src={hackerHog}
        alt=""
        className="h-40 w-auto select-none"
        draggable={false}
      />
      <Box className="text-center">
        <Text as="div" weight="medium" className="text-(--gray-12) text-[18px]">
          PostHog Work
        </Text>
        <Text as="div" className="text-(--gray-11) text-[13px]">
          Set up recurring projects with the context PostHog already has.
        </Text>
      </Box>
      <WorkSuggestionsHoverCard />
      <button
        type="button"
        onClick={skipWorkOnboarding}
        className="cursor-pointer bg-transparent text-(--gray-10) text-[13px] underline-offset-2 hover:text-(--gray-12) hover:underline"
      >
        Skip onboarding
      </button>
    </Flex>
  );
}
