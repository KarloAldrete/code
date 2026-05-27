import { useExtensionsStore } from "@features/extensions/stores/extensionsStore";
import { Box, Flex, Text } from "@radix-ui/themes";
import { ExtensionFrame } from "./ExtensionFrame";

interface ExtensionViewProps {
  sidebarItemId: string;
}

export function ExtensionView({ sidebarItemId }: ExtensionViewProps) {
  const item = useExtensionsStore((state) =>
    state.sidebar.find((sidebarItem) => sidebarItem.id === sidebarItemId),
  );

  if (!item) {
    return (
      <Flex align="center" justify="center" height="100%">
        <Text className="text-gray-10 text-sm">Extension view not found</Text>
      </Flex>
    );
  }

  return (
    <Flex direction="column" height="100%" className="bg-gray-1">
      <Flex
        align="center"
        px="4"
        py="2"
        className="shrink-0 border-gray-6 border-b"
      >
        <Text className="font-medium text-gray-12 text-sm">{item.title}</Text>
      </Flex>
      <Box flexGrow="1" overflow="hidden">
        <ExtensionFrame item={item} />
      </Box>
    </Flex>
  );
}
