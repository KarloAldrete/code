import { Flex, Text } from "@radix-ui/themes";
import type { SkillSource } from "@shared/types/skills";
import { SOURCE_CONFIG } from "./SkillCard";

interface SourceFilterChipsProps {
  available: SkillSource[];
  selected: Set<SkillSource>;
  onToggle: (source: SkillSource) => void;
}

export function SourceFilterChips({
  available,
  selected,
  onToggle,
}: SourceFilterChipsProps) {
  if (available.length === 0) return null;

  return (
    <Flex gap="1" wrap="wrap" align="center">
      {available.map((source) => {
        const config = SOURCE_CONFIG[source];
        const Icon = config.icon;
        const isOn = selected.has(source);
        return (
          <button
            key={source}
            type="button"
            onClick={() => onToggle(source)}
            className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] transition-colors ${
              isOn
                ? "border-accent-8 bg-accent-3 text-accent-12"
                : "border-gray-6 bg-gray-2 text-gray-11 hover:border-gray-8 hover:bg-gray-3"
            }`}
          >
            <Icon size={12} weight="duotone" />
            <Text className="text-[12px]">{config.label}</Text>
          </button>
        );
      })}
    </Flex>
  );
}
