import { NoteIcon } from "@phosphor-icons/react";
import { Box } from "@radix-ui/themes";
import type { NoteTile as NoteTileType } from "@shared/types/work-projects";
import { useCallback, useEffect, useState } from "react";
import { TileFrame } from "../TileFrame";

const TONE_BG: Record<NonNullable<NoteTileType["tone"]>, string> = {
  yellow: "bg-(--yellow-3)",
  blue: "bg-(--blue-3)",
  green: "bg-(--green-3)",
  pink: "bg-(--pink-3)",
  neutral: "bg-(--gray-2)",
};

interface NoteTileProps {
  tile: NoteTileType;
  onRemove?: () => void;
  onResize?: Parameters<typeof TileFrame>[0]["onResize"];
  onApplyPending?: () => void;
  onRejectPending?: () => void;
  onUpdateBody?: (body: string) => void;
}

export function NoteTile({
  tile,
  onRemove,
  onResize,
  onApplyPending,
  onRejectPending,
  onUpdateBody,
}: NoteTileProps) {
  const [value, setValue] = useState(tile.body);

  useEffect(() => {
    setValue(tile.body);
  }, [tile.body]);

  const commit = useCallback(() => {
    if (!onUpdateBody) return;
    if (value === tile.body) return;
    onUpdateBody(value);
  }, [value, tile.body, onUpdateBody]);

  return (
    <TileFrame
      tile={tile}
      icon={NoteIcon}
      label="Note"
      onRemove={onRemove}
      onResize={onResize}
      onApplyPending={onApplyPending}
      onRejectPending={onRejectPending}
    >
      <Box className={`h-full ${TONE_BG[tile.tone ?? "yellow"]}`}>
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          placeholder="Capture a thought…"
          className="block h-full min-h-[80px] w-full resize-none bg-transparent px-3 py-2 text-(--gray-12) text-[13px] leading-snug outline-none placeholder:text-(--gray-9)"
          readOnly={!onUpdateBody}
        />
      </Box>
    </TileFrame>
  );
}
