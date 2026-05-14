import { Flex, Text } from "@radix-ui/themes";
import explorerHog from "@renderer/assets/images/hedgehogs/explorer-hog.png";

interface HedgemonyEmptyStateProps {
  onBuildFirstNest?: () => void;
}

export function HedgemonyEmptyState({
  onBuildFirstNest,
}: HedgemonyEmptyStateProps) {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      height="100%"
      px="5"
      className="pointer-events-none"
    >
      <Flex direction="column" align="center" className="max-w-[420px]">
        <img
          src={explorerHog}
          alt=""
          className="mb-[12px] w-[120px] opacity-80"
        />
        <Text align="center" className="font-medium text-(--gray-10) text-sm">
          No nests yet
        </Text>
        <Text
          align="center"
          mt="1"
          className="text-(--gray-9) text-[13px] leading-[1.35]"
        >
          Create a nest to define a goal. Hoglets will gather around it to do
          the work.
        </Text>
        {onBuildFirstNest && (
          <button
            type="button"
            onClick={onBuildFirstNest}
            className="pointer-events-auto mt-4 rounded-(--radius-2) border border-(--accent-7) bg-(--accent-3) px-3 py-1.5 font-medium text-(--accent-11) text-[12px] shadow-sm transition-colors hover:bg-(--accent-4) hover:text-(--accent-12)"
          >
            Build first nest
          </button>
        )}
      </Flex>
    </Flex>
  );
}
