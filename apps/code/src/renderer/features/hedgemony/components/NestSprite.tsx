import type { Nest } from "@main/services/hedgemony/schemas";
import { Tooltip } from "@radix-ui/themes";
import builderHog from "@renderer/assets/images/hedgehogs/builder-hog-03.png";
import { motion, useMotionValue } from "framer-motion";
import { useRef } from "react";

const SPRITE_SIZE = 96;
const DRAG_THRESHOLD_PX = 4;

interface NestSpriteProps {
  nest: Nest;
  onClick?: (nest: Nest) => void;
  onMove?: (nest: Nest, mapX: number, mapY: number) => void;
}

export function NestSprite({ nest, onClick, onMove }: NestSpriteProps) {
  const offsetX = useMotionValue(0);
  const offsetY = useMotionValue(0);
  const draggedSinceDown = useRef(false);

  return (
    <div
      className="-translate-x-1/2 -translate-y-1/2 absolute"
      style={{
        left: `calc(50% + ${nest.mapX}px)`,
        top: `calc(50% + ${nest.mapY}px)`,
      }}
    >
      <Tooltip content={nest.goalPrompt} side="bottom">
        <motion.button
          type="button"
          drag
          dragMomentum={false}
          data-hedgemony-nest
          aria-label={`Open ${nest.name}`}
          className="flex cursor-grab flex-col items-center border-0 bg-transparent p-0 active:cursor-grabbing"
          style={{ x: offsetX, y: offsetY }}
          whileHover={{ scale: 1.03 }}
          whileDrag={{ scale: 1.08, zIndex: 10 }}
          onPointerDown={() => {
            draggedSinceDown.current = false;
          }}
          onDrag={(_, info) => {
            if (Math.hypot(info.offset.x, info.offset.y) > DRAG_THRESHOLD_PX) {
              draggedSinceDown.current = true;
            }
          }}
          onDragEnd={() => {
            const dx = offsetX.get();
            const dy = offsetY.get();
            offsetX.set(0);
            offsetY.set(0);
            if (!draggedSinceDown.current) return;
            onMove?.(
              nest,
              Math.round(nest.mapX + dx),
              Math.round(nest.mapY + dy),
            );
          }}
          onClick={(event) => {
            event.stopPropagation();
            if (draggedSinceDown.current) return;
            onClick?.(nest);
          }}
        >
          <div
            className="flex items-center justify-center rounded-full bg-(--gray-2) shadow-md ring-(--accent-7) ring-2"
            style={{ width: SPRITE_SIZE, height: SPRITE_SIZE }}
          >
            <img
              src={builderHog}
              alt=""
              className="pointer-events-none select-none"
              style={{ width: SPRITE_SIZE * 0.8, height: SPRITE_SIZE * 0.8 }}
              draggable={false}
            />
          </div>
          <div className="mt-1 max-w-[160px] truncate rounded-(--radius-2) bg-(--gray-3) px-2 py-0.5 font-medium text-(--gray-12) text-[12px] shadow-sm">
            {nest.name}
          </div>
        </motion.button>
      </Tooltip>
    </div>
  );
}
