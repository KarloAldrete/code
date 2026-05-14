import { CheckCircle, XIcon } from "@phosphor-icons/react";
import { Box, Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { useEffect, useMemo, useState } from "react";
import { formatRelative, getEventStyle } from "../feedFormatting";
import { useFeedReadStore } from "../stores/feedReadStore";
import type { FeedItem } from "../types";
import { iconForKind } from "./feedIcons";

interface CatchUpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: FeedItem[];
}

export function CatchUpModal({ open, onOpenChange, items }: CatchUpModalProps) {
  const readIds = useFeedReadStore((s) => s.readIds);
  const markRead = useFeedReadStore((s) => s.markRead);

  // Snapshot the queue at open time so marking-as-read mid-flow doesn't
  // remove the current card from under the user.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional
  const queue = useMemo<FeedItem[]>(() => {
    if (!open) return [];
    return items.filter((item) => !readIds[item.id]);
  }, [open]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  const total = queue.length;
  const current = queue[index];

  const handleNext = () => {
    if (index >= total - 1) {
      onOpenChange(false);
      return;
    }
    setIndex(index + 1);
  };

  const handleSkip = () => {
    handleNext();
  };

  const handleMarkReadNext = () => {
    if (current) markRead(current.id);
    handleNext();
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="560px">
        <Flex align="center" justify="between" mb="3">
          <Dialog.Title mb="0" className="text-base">
            Catch up
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

        {total === 0 ? (
          <CatchUpDone onClose={() => onOpenChange(false)} />
        ) : current ? (
          <>
            <Text size="1" className="text-(--gray-11)">
              {index + 1} of {total}
            </Text>
            <Box className="my-3 h-1 w-full overflow-hidden rounded-full bg-(--gray-4)">
              <Box
                className="h-full bg-(--accent-9) transition-all"
                style={{ width: `${((index + 1) / total) * 100}%` }}
              />
            </Box>

            <CatchUpCard item={current} />

            <Flex justify="between" align="center" mt="4">
              <Button size="2" variant="soft" color="gray" onClick={handleSkip}>
                Skip
              </Button>
              <Flex gap="2">
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
                <Button size="2" onClick={handleMarkReadNext}>
                  {index === total - 1
                    ? "Mark read & finish"
                    : "Mark read & next"}
                </Button>
              </Flex>
            </Flex>
          </>
        ) : (
          <CatchUpDone onClose={() => onOpenChange(false)} />
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}

function CatchUpCard({ item }: { item: FeedItem }) {
  const event = getEventStyle(item);
  return (
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
  );
}

function CatchUpDone({ onClose }: { onClose: () => void }) {
  return (
    <Flex direction="column" align="center" justify="center" gap="3" py="6">
      <CheckCircle size={40} weight="duotone" className="text-(--green-11)" />
      <Text size="3" weight="medium">
        You're all caught up
      </Text>
      <Text size="2" className="text-(--gray-11)">
        Nothing new in your feed.
      </Text>
      <Button size="2" mt="2" onClick={onClose}>
        Done
      </Button>
    </Flex>
  );
}
