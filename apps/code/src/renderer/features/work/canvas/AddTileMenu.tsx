import {
  ChartLineUp,
  FileText,
  GaugeIcon,
  Lightbulb,
  NoteIcon,
  Plus,
} from "@phosphor-icons/react";
import { Box, Text } from "@radix-ui/themes";
import type { NewTileInput, TileType } from "@shared/types/work-projects";
import { type ComponentType, useEffect, useRef, useState } from "react";

interface AddTileMenuProps {
  onAdd: (tile: NewTileInput) => void;
}

interface TileTypeOption {
  type: Exclude<TileType, "title">;
  label: string;
  description: string;
  icon: ComponentType<{ size?: number; weight?: "duotone" | "regular" }>;
  factory: () => NewTileInput;
}

const OPTIONS: TileTypeOption[] = [
  {
    type: "note",
    label: "Sticky note",
    description: "Quick thought to capture or share with the team.",
    icon: NoteIcon,
    factory: () => ({
      type: "note",
      body: "",
      tone: "yellow",
      size: "sm",
    }),
  },
  {
    type: "headline",
    label: "Headline stat",
    description: "Big number with a sparkline. Optional PostHog query.",
    icon: GaugeIcon,
    factory: () => ({
      type: "headline",
      label: "Headline metric",
      fallbackValue: "—",
      fallbackDelta: "Set a target",
      fallbackSparkline: [0, 0, 0, 0, 0],
      size: "md",
    }),
  },
  {
    type: "insight",
    label: "PostHog dashboard",
    description: "Link a PostHog dashboard or insight.",
    icon: ChartLineUp,
    factory: () => ({
      type: "insight",
      posthogProjectId: 2,
      title: "New dashboard",
      url: "https://us.posthog.com/project/2",
      size: "md",
    }),
  },
  {
    type: "file",
    label: "File",
    description: "Markdown doc the team can edit inline.",
    icon: FileText,
    factory: () => ({
      type: "file",
      filename: "untitled.md",
      contents: "# New file\n",
      size: "md",
    }),
  },
  {
    type: "skill_output",
    label: "Skill output",
    description: "Pin the latest run of a skill (asks chat to fill).",
    icon: Lightbulb,
    factory: () => ({
      type: "skill_output",
      skillName: "Untitled skill",
      size: "md",
    }),
  },
];

export function AddTileMenu({ onAdd }: AddTileMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <Box className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 items-center gap-1.5 rounded-(--radius-2) border border-(--gray-5) bg-(--gray-1) px-3 text-(--gray-11) text-[12px] transition-colors hover:border-(--gray-7) hover:bg-(--gray-2) hover:text-(--gray-12)"
      >
        <Plus size={12} weight="bold" />
        Add tile
      </button>
      {open && (
        <Box className="absolute top-9 right-0 z-20 w-[280px] overflow-hidden rounded-(--radius-3) border border-(--gray-5) bg-(--gray-1) shadow-lg">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                type="button"
                key={opt.type}
                onClick={() => {
                  onAdd(opt.factory());
                  setOpen(false);
                }}
                className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-(--gray-2)"
              >
                <Box className="mt-0.5 text-(--gray-11)">
                  <Icon size={14} weight="duotone" />
                </Box>
                <Box className="min-w-0">
                  <Text
                    as="div"
                    weight="medium"
                    className="text-(--gray-12) text-[13px]"
                  >
                    {opt.label}
                  </Text>
                  <Text
                    as="div"
                    className="text-(--gray-11) text-[11px] leading-snug"
                  >
                    {opt.description}
                  </Text>
                </Box>
              </button>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
