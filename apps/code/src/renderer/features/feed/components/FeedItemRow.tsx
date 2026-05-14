import { Button, Flex, Text } from "@radix-ui/themes";
import { formatRelative, getEventStyle } from "../feedFormatting";
import { useFeedReadStore } from "../stores/feedReadStore";
import type { FeedItem } from "../types";
import { iconForKind } from "./feedIcons";

interface FeedItemRowProps {
  item: FeedItem;
  isRead: boolean;
  onOpen: (item: FeedItem) => void;
}

export function FeedItemRow({ item, isRead, onOpen }: FeedItemRowProps) {
  const markRead = useFeedReadStore((s) => s.markRead);
  const markUnread = useFeedReadStore((s) => s.markUnread);
  const event = getEventStyle(item);

  const handleToggleRead = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRead) markUnread(item.id);
    else markRead(item.id);
  };

  const handleRowClick = () => {
    if (!isRead) markRead(item.id);
    onOpen(item);
  };

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Flex
      px="5"
      py="3"
      gap="3"
      align="start"
      onClick={handleRowClick}
      className={`group cursor-pointer transition-colors hover:bg-(--gray-2) ${
        isRead ? "opacity-70" : ""
      }`}
    >
      <button
        type="button"
        onClick={handleToggleRead}
        aria-label={isRead ? "Mark as unread" : "Mark as read"}
        className="mt-1.5 flex h-2 w-2 shrink-0 items-center justify-center"
      >
        <span
          className={`block h-2 w-2 rounded-full ${
            isRead ? "bg-(--gray-6)" : "bg-(--accent-9)"
          }`}
        />
      </button>

      <Flex
        align="center"
        justify="center"
        className="mt-0.5 h-6 w-6 shrink-0 rounded-(--radius-2) bg-(--gray-3) text-(--gray-11)"
      >
        {iconForKind(item.kind, 14)}
      </Flex>

      <Flex direction="column" gap="1" className="min-w-0 flex-1">
        <Text
          size="1"
          weight="bold"
          className={`uppercase tracking-wide ${event.className}`}
        >
          {event.label}
        </Text>

        <Text size="2" weight={isRead ? "regular" : "medium"}>
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

      <Flex
        gap="2"
        align="center"
        className="shrink-0"
        onClick={stopPropagation}
      >
        <Button size="1" variant="soft" color="gray" onClick={() => undefined}>
          Monitor
        </Button>
        <Button size="1" variant="soft" onClick={() => undefined}>
          Explore
        </Button>
      </Flex>
    </Flex>
  );
}
