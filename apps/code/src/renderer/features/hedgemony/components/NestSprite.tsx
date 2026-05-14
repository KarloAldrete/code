import type { Nest } from "@main/services/hedgemony/schemas";
import { Tooltip } from "@radix-ui/themes";
import builderHog from "@renderer/assets/images/hedgehogs/builder-hog-03.png";
import { motion } from "framer-motion";

const SPRITE_SIZE = 96;
const SELECTION_RING_SIZE = SPRITE_SIZE + 22;

interface NestSpriteProps {
  nest: Nest;
  selected?: boolean;
  dimmed?: boolean;
  onSelect?: (nest: Nest) => void;
}

function territoryBackground(nest: Nest): string {
  if (nest.health !== "ok") {
    return "radial-gradient(circle, rgba(251, 146, 60, 0.22) 0%, rgba(251, 146, 60, 0.1) 42%, transparent 72%)";
  }
  if (nest.status === "needs_attention") {
    return "radial-gradient(circle, rgba(248, 113, 113, 0.22) 0%, rgba(248, 113, 113, 0.1) 42%, transparent 72%)";
  }
  if (nest.status === "dormant") {
    return "radial-gradient(circle, rgba(148, 163, 184, 0.18) 0%, rgba(148, 163, 184, 0.08) 42%, transparent 72%)";
  }
  return "radial-gradient(circle, rgba(251, 146, 60, 0.18) 0%, rgba(251, 146, 60, 0.08) 42%, transparent 72%)";
}

export function NestSprite({
  nest,
  selected,
  dimmed,
  onSelect,
}: NestSpriteProps) {
  return (
    <motion.div
      className="absolute top-1/2 left-1/2"
      initial={false}
      animate={{ x: nest.mapX, y: nest.mapY }}
      transition={{ type: "spring", damping: 26, stiffness: 180, mass: 0.7 }}
      style={{ opacity: dimmed ? 0.42 : 1 }}
    >
      <Tooltip content={nest.goalPrompt} side="bottom">
        <motion.button
          type="button"
          data-hedgemony-nest
          aria-label={`Select ${nest.name}`}
          className="-translate-x-1/2 -translate-y-1/2 flex cursor-pointer flex-col items-center border-0 bg-transparent p-0"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onContextMenu={(event) => event.preventDefault()}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.(nest);
          }}
        >
          <div className="relative">
            <div
              className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2 rounded-full"
              style={{
                width: selected ? 260 : 220,
                height: selected ? 260 : 220,
                background: territoryBackground(nest),
              }}
            />
            {selected && (
              <motion.span
                className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2 rounded-full border-(--accent-9) border-2"
                style={{
                  width: SELECTION_RING_SIZE,
                  height: SELECTION_RING_SIZE,
                }}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              />
            )}
            <div
              className="flex items-center justify-center rounded-full bg-(--gray-2) shadow-md ring-(--accent-7) ring-2"
              style={{ width: SPRITE_SIZE, height: SPRITE_SIZE }}
            >
              <img
                src={builderHog}
                alt=""
                className="pointer-events-none select-none"
                style={{
                  width: SPRITE_SIZE * 0.8,
                  height: SPRITE_SIZE * 0.8,
                }}
                draggable={false}
              />
            </div>
          </div>
          <div className="mt-1 max-w-[160px] truncate rounded-(--radius-2) bg-(--gray-3) px-2 py-0.5 font-medium text-(--gray-12) text-[12px] shadow-sm">
            {nest.name}
          </div>
        </motion.button>
      </Tooltip>
    </motion.div>
  );
}
