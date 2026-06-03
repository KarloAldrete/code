import { Brain } from "@phosphor-icons/react";
import { Box, Text } from "@radix-ui/themes";
import { memo, useState } from "react";
import { ExpandableIcon } from "./toolCallUtils";

interface ThoughtViewProps {
  content: string;
  isLoading: boolean;
}

export const ThoughtView = memo(function ThoughtView({
  content,
  isLoading,
}: ThoughtViewProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Box>
      <button
        type="button"
        onClick={() => setIsExpanded((v) => !v)}
        className="group flex cursor-pointer items-center gap-2 border-none bg-transparent p-0 py-0.5"
      >
        <ExpandableIcon
          icon={Brain}
          isLoading={isLoading}
          isExpandable
          isExpanded={isExpanded}
        />
        <Text className="text-[13px] text-gray-11">Thinking</Text>
      </button>
      {isExpanded && (
        <Box className="mt-1 ml-5 max-w-4xl overflow-hidden rounded-lg border border-gray-6">
          <Box className="max-h-64 overflow-auto px-3 py-2">
            <Text asChild className="text-[12px] text-gray-10">
              <pre className="m-0 hyphens-auto whitespace-pre-wrap break-words font-mono">
                {content}
              </pre>
            </Text>
          </Box>
        </Box>
      )}
    </Box>
  );
});
