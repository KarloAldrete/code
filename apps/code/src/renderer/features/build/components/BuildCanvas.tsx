import { ArrowsIn, ArrowsOut, SquaresFour } from "@phosphor-icons/react";
import { Box, Flex, Text } from "@radix-ui/themes";

interface BuildCanvasProps {
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

export function BuildCanvas({
  isFullscreen,
  onToggleFullscreen,
}: BuildCanvasProps) {
  return (
    <Box className="relative h-full w-full overflow-hidden rounded-(--radius-4) border border-(--gray-5) bg-(--gray-1) shadow-sm">
      <button
        type="button"
        onClick={onToggleFullscreen}
        aria-label={isFullscreen ? "Minimize canvas" : "Maximize canvas"}
        title={isFullscreen ? "Minimize" : "Full screen"}
        className="absolute top-3 right-3 z-1 flex h-8 w-8 items-center justify-center rounded-(--radius-2) border border-(--gray-5) bg-(--gray-1)/90 text-(--gray-11) backdrop-blur transition-colors hover:bg-(--gray-3) hover:text-(--gray-12)"
      >
        {isFullscreen ? <ArrowsIn size={16} /> : <ArrowsOut size={16} />}
      </button>

      <Flex
        direction="column"
        align="center"
        justify="center"
        className="h-full w-full px-6 text-center"
        gap="3"
      >
        <Flex
          align="center"
          justify="center"
          className="h-12 w-12 rounded-full bg-(--orange-3) text-(--orange-11)"
        >
          <SquaresFour size={24} weight="duotone" />
        </Flex>
        <Text size="6" weight="bold" className="text-(--gray-12)">
          Create a canvas
        </Text>
        <Text size="2" className="max-w-120 text-(--gray-11)">
          Build the killer dashboard, something you can share with your team to
          come back to, or pin to your bookmarks for monitoring the most
          important things you care about.
        </Text>
      </Flex>
    </Box>
  );
}
