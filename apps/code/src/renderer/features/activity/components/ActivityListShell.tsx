import { Box, Flex, Text } from "@radix-ui/themes";
import type React from "react";

interface ActivityListShellProps {
  isLoading: boolean;
  error: Error | null;
  emptyMessage: string;
  itemCount: number;
  children: React.ReactNode;
}

export function ActivityListShell({
  isLoading,
  error,
  emptyMessage,
  itemCount,
  children,
}: ActivityListShellProps) {
  return (
    <Box className="h-full overflow-auto">
      {isLoading ? (
        <Status message="Loading..." />
      ) : error ? (
        <Status message={`Failed to load: ${error.message}`} />
      ) : itemCount === 0 ? (
        <Status message={emptyMessage} />
      ) : (
        children
      )}
    </Box>
  );
}

function Status({ message }: { message: string }) {
  return (
    <Flex align="center" justify="center" className="h-full">
      <Text size="2" className="text-(--gray-11)">
        {message}
      </Text>
    </Flex>
  );
}
