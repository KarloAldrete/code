import { XIcon } from "@phosphor-icons/react";
import { Box, Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { formatRelative, getEventStyle } from "../feedFormatting";
import type { FeedItem } from "../types";
import { iconForKind } from "./feedIcons";

interface FeedItemDetailModalProps {
  item: FeedItem | null;
  onOpenChange: (open: boolean) => void;
}

export function FeedItemDetailModal({
  item,
  onOpenChange,
}: FeedItemDetailModalProps) {
  const open = item !== null;
  const event = item ? getEventStyle(item) : null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="560px">
        {item && event ? (
          <>
            <Flex align="center" justify="between" mb="3">
              <Dialog.Title mb="0" className="text-base">
                Details
              </Dialog.Title>
              <Dialog.Close>
                <button
                  type="button"
                  className="rounded p-1 text-gray-11 hover:bg-gray-3 hover:text-gray-12"
                  aria-label="Close"
                >
                  <XIcon size={16} />
                </button>
              </Dialog.Close>
            </Flex>

            <Box className="rounded-(--radius-3) border border-(--gray-5) bg-(--gray-2) p-4">
              <Flex gap="3" align="start">
                <Flex
                  align="center"
                  justify="center"
                  className="h-8 w-8 shrink-0 rounded-(--radius-2) bg-(--gray-3) text-(--gray-11)"
                >
                  {iconForKind(item.kind, 18)}
                </Flex>
                <Flex direction="column" gap="1" className="min-w-0 flex-1">
                  <Text
                    size="1"
                    weight="bold"
                    className={`uppercase tracking-wide ${event.className}`}
                  >
                    {event.label}
                  </Text>
                  <Text size="3" weight="medium">
                    {item.title}
                  </Text>
                  {item.description && (
                    <Text size="2" className="text-(--gray-11)">
                      {item.description}
                    </Text>
                  )}
                  <Text size="1" className="mt-1 text-(--gray-10)">
                    {formatRelative(item.timestamp)}
                  </Text>
                </Flex>
              </Flex>
            </Box>

            <Flex justify="end" gap="2" mt="4">
              <Button
                size="2"
                variant="soft"
                color="gray"
                onClick={() => undefined}
              >
                Monitor
              </Button>
              <Button size="2" variant="soft" onClick={() => undefined}>
                Explore
              </Button>
            </Flex>
          </>
        ) : null}
      </Dialog.Content>
    </Dialog.Root>
  );
}
