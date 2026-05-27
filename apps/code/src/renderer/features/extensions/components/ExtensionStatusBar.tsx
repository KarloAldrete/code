import { useExtensionsStore } from "@features/extensions/stores/extensionsStore";
import { Box, Flex } from "@radix-ui/themes";
import { ExtensionFrame } from "./ExtensionFrame";

interface ExtensionStatusBarProps {
  repoPath?: string | null;
  taskId?: string;
  maxWidth?: number | string;
}

export function ExtensionStatusBar({
  repoPath,
  taskId,
  maxWidth,
}: ExtensionStatusBarProps) {
  const items = useExtensionsStore((state) => state.statusBar);

  if (items.length === 0) return null;

  return (
    <Box className="sticky bottom-0 z-[2] border-gray-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Flex
        align="center"
        gap="1"
        className="no-drag mx-auto min-h-[32px] min-w-0 px-2 py-1"
        style={{ maxWidth }}
      >
        {items.map((item) => (
          <Box
            key={item.id}
            overflow="hidden"
            className="h-[24px] shrink-0 rounded bg-gray-2"
            style={{ width: `${item.width ?? 180}px` }}
          >
            <ExtensionFrame
              item={item}
              repoPath={repoPath}
              taskId={taskId}
              className="h-full w-full border-0 bg-transparent"
            />
          </Box>
        ))}
      </Flex>
    </Box>
  );
}
