import { ArrowSquareOut, ChartLineUp } from "@phosphor-icons/react";
import { Box, Flex, Text } from "@radix-ui/themes";
import type {
  InsightTile as InsightTileType,
  TileSize,
} from "@shared/types/work-projects";
import { openUrlInBrowser } from "@utils/browser";
import { TileFrame } from "../TileFrame";

interface InsightTileProps {
  tile: InsightTileType;
  onRemove?: () => void;
  onResize?: (size: TileSize) => void;
  onApplyPending?: () => void;
  onRejectPending?: () => void;
}

export function InsightTile({
  tile,
  onRemove,
  onResize,
  onApplyPending,
  onRejectPending,
}: InsightTileProps) {
  return (
    <TileFrame
      tile={tile}
      icon={ChartLineUp}
      label={tile.dashboardId ? "PostHog dashboard" : "PostHog insight"}
      headerAction={
        <button
          type="button"
          onClick={() => openUrlInBrowser(tile.url)}
          className="flex items-center gap-1 text-(--gray-10) text-[11px] hover:text-(--gray-12)"
        >
          Open
          <ArrowSquareOut size={10} weight="bold" />
        </button>
      }
      onRemove={onRemove}
      onResize={onResize}
      onApplyPending={onApplyPending}
      onRejectPending={onRejectPending}
    >
      <Box className="px-4 py-3">
        <Flex direction="column" gap="2">
          <Text
            as="div"
            weight="medium"
            className="text-(--gray-12) text-[14px] leading-tight"
          >
            {tile.title}
          </Text>
          {tile.description && (
            <Text
              as="div"
              className="line-clamp-3 text-(--gray-11) text-[12px] leading-snug"
            >
              {tile.description}
            </Text>
          )}
          {tile.owner && (
            <Text as="div" className="text-(--gray-10) text-[11px]">
              {tile.owner}
            </Text>
          )}
        </Flex>
      </Box>
    </TileFrame>
  );
}
