import { useSetHeaderContent } from "@hooks/useSetHeaderContent";
import { GearSix, Newspaper, XIcon } from "@phosphor-icons/react";
import { Box, Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { useMemo, useState } from "react";
import { useFeed } from "../hooks/useFeed";
import { useFeedReadStore } from "../stores/feedReadStore";
import { useInboxPreferencesStore } from "../stores/inboxPreferencesStore";
import type { FeedItem } from "../types";
import { CatchUpModal } from "./CatchUpModal";
import { FeedItemDetailModal } from "./FeedItemDetailModal";
import { FeedItemRow } from "./FeedItemRow";
import { InboxPreferencesWizard } from "./InboxPreferencesWizard";

export function FeedView() {
  const hasCompletedWizard = useInboxPreferencesStore(
    (s) => s.hasCompletedWizard,
  );
  const [editingPreferences, setEditingPreferences] = useState(false);
  const { items, isLoading, error } = useFeed();
  const readIds = useFeedReadStore((s) => s.readIds);
  const markAllRead = useFeedReadStore((s) => s.markAllRead);
  const [catchUpOpen, setCatchUpOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<FeedItem | null>(null);

  const showOnboarding = !hasCompletedWizard;

  const unreadCount = useMemo(
    () => items.filter((item) => !readIds[item.id]).length,
    [items, readIds],
  );

  const headerContent = useMemo(
    () => (
      <Flex align="center" gap="2" className="w-full min-w-0">
        <Newspaper size={12} className="shrink-0 text-gray-10" />
        <Text
          className="truncate whitespace-nowrap font-medium text-[13px]"
          title="Feed"
        >
          Feed
        </Text>
        {unreadCount > 0 && (
          <span className="ml-1 inline-flex shrink-0 items-center justify-center rounded-full bg-(--accent-9) px-1.5 font-medium text-[10px] text-white leading-none">
            {unreadCount}
          </span>
        )}
      </Flex>
    ),
    [unreadCount],
  );
  useSetHeaderContent(headerContent);

  if (showOnboarding) {
    return (
      <Flex direction="column" height="100%" className="overflow-hidden">
        <InboxPreferencesWizard
          showIntro={true}
          submitLabel="Save and continue"
          onDone={() => setEditingPreferences(false)}
        />
      </Flex>
    );
  }

  return (
    <Flex direction="column" height="100%" className="overflow-hidden">
      <Flex
        align="center"
        justify="between"
        px="5"
        py="3"
        className="shrink-0 border-gray-6 border-b"
      >
        <Box>
          <Text as="div" size="3" weight="medium">
            What's new
          </Text>
          <Text as="div" size="1" className="text-(--gray-11)">
            Stay up to date with new product development - monitor or explore
            further if something is relevant for you
          </Text>
        </Box>
        <Flex gap="2" align="center">
          <Button
            size="1"
            variant="solid"
            onClick={() => setCatchUpOpen(true)}
            disabled={unreadCount === 0}
          >
            Catch up
            {unreadCount > 0 ? ` (${unreadCount})` : ""}
          </Button>
          <Button
            size="1"
            variant="soft"
            color="gray"
            onClick={() => markAllRead(items.map((i) => i.id))}
            disabled={unreadCount === 0}
          >
            Mark all as read
          </Button>
          <Button
            size="1"
            variant="soft"
            color="gray"
            onClick={() => setEditingPreferences(true)}
          >
            <GearSix size={12} />
            Preferences
          </Button>
        </Flex>
      </Flex>

      <Box flexGrow="1" overflow="auto">
        {isLoading ? (
          <FeedStatus message="Loading recent activity..." />
        ) : error ? (
          <FeedStatus message={`Failed to load feed: ${error.message}`} />
        ) : items.length === 0 ? (
          <FeedStatus message="No recent activity in the last 10 days." />
        ) : (
          <Flex direction="column" className="divide-y divide-(--gray-5)">
            {items.map((item) => (
              <FeedItemRow
                key={item.id}
                item={item}
                isRead={Boolean(readIds[item.id])}
                onOpen={setDetailItem}
              />
            ))}
          </Flex>
        )}
      </Box>

      <CatchUpModal
        open={catchUpOpen}
        onOpenChange={setCatchUpOpen}
        items={items}
      />

      <FeedItemDetailModal
        item={detailItem}
        onOpenChange={(open) => {
          if (!open) setDetailItem(null);
        }}
      />

      <Dialog.Root
        open={editingPreferences}
        onOpenChange={setEditingPreferences}
      >
        <Dialog.Content
          maxWidth="560px"
          className="max-h-[85vh] overflow-y-auto"
        >
          <Flex align="center" justify="between" mb="3">
            <Dialog.Title mb="0" className="text-base">
              Inbox preferences
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
          <InboxPreferencesWizard
            showIntro={false}
            submitLabel="Save preferences"
            layout="modal"
            onDone={() => setEditingPreferences(false)}
          />
        </Dialog.Content>
      </Dialog.Root>
    </Flex>
  );
}

function FeedStatus({ message }: { message: string }) {
  return (
    <Flex align="center" justify="center" className="h-full">
      <Text size="2" className="text-(--gray-11)">
        {message}
      </Text>
    </Flex>
  );
}
