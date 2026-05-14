import { Tooltip } from "@components/ui/Tooltip";
import { SidebarItem } from "@features/sidebar/components/SidebarItem";
import { useTasks } from "@features/tasks/hooks/useTasks";
import { Archive, ChatCircleDots, Plus } from "@phosphor-icons/react";
import { ScrollArea } from "@posthog/quill";
import { Box, Flex, Text } from "@radix-ui/themes";
import { trpcClient } from "@renderer/trpc";
import type { Task } from "@shared/types";
import { useNavigationStore } from "@stores/navigationStore";
import { logger } from "@utils/logger";
import { toast } from "@utils/toast";
import { useCallback, useMemo } from "react";
import { useChatStore } from "../stores/chatStore";

const log = logger.scope("chat-sidebar");

interface ChatItemProps {
  task: Task;
  isActive: boolean;
  onSelect: () => void;
  onArchive: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

function ChatItem({
  task,
  isActive,
  onSelect,
  onArchive,
  onContextMenu,
}: ChatItemProps) {
  return (
    <SidebarItem
      depth={0}
      icon={<ChatCircleDots size={16} weight={isActive ? "fill" : "regular"} />}
      label={task.title || "Untitled chat"}
      isActive={isActive}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      endContent={
        <Tooltip content="Archive chat" side="top">
          {/* biome-ignore lint/a11y/useSemanticElements: Cannot use button inside parent button (SidebarItem) */}
          <span
            role="button"
            tabIndex={0}
            className="hidden h-5 w-5 cursor-pointer items-center justify-center rounded text-gray-10 transition-colors hover:bg-gray-4 hover:text-gray-12 group-hover:flex"
            onClick={(e) => {
              e.stopPropagation();
              onArchive();
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                e.stopPropagation();
                onArchive();
              }
            }}
          >
            <Archive size={12} />
          </span>
        </Tooltip>
      }
    />
  );
}

export function ChatSidebarMenu() {
  const { data: tasks } = useTasks();
  const chatTaskIds = useChatStore((s) => s.chatTaskIds);
  const archivedChats = useChatStore((s) => s.archivedChats);
  const archiveChat = useChatStore((s) => s.archiveChat);
  const chatView = useNavigationStore((s) => s.chatView);
  const activeChatId = useNavigationStore((s) => s.activeChatId);
  const navigateToChatHome = useNavigationStore((s) => s.navigateToChatHome);
  const navigateToChatConversation = useNavigationStore(
    (s) => s.navigateToChatConversation,
  );

  const chatTasks = useMemo(() => {
    if (!tasks) return [];
    const byId = new Map(tasks.map((t) => [t.id, t]));
    return chatTaskIds
      .map((id) => byId.get(id))
      .filter((t): t is Task => !!t && !archivedChats[t.id]);
  }, [tasks, chatTaskIds, archivedChats]);

  const handleArchive = useCallback(
    (taskId: string) => {
      const nav = useNavigationStore.getState();
      if (
        nav.chatView === "conversation" &&
        nav.activeChatId === taskId &&
        nav.navigateToChatHome
      ) {
        nav.navigateToChatHome();
      }
      archiveChat(taskId);
      toast.success("Chat archived");
    },
    [archiveChat],
  );

  const handleContextMenu = useCallback(
    async (task: Task, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        const result = await trpcClient.contextMenu.showChatContextMenu.mutate({
          chatTitle: task.title || "Untitled chat",
        });
        if (!result.action) return;
        if (result.action.type === "archive") {
          handleArchive(task.id);
        }
      } catch (error) {
        log.error("Chat context menu error", error);
      }
    },
    [handleArchive],
  );

  const isHomeActive = chatView === "home";

  return (
    <Box height="100%" position="relative">
      <ScrollArea className="h-full overflow-y-auto overflow-x-hidden">
        <Flex direction="column" py="2" px="2" gap="1px">
          <Box>
            <SidebarItem
              depth={0}
              icon={
                <Plus size={16} weight={isHomeActive ? "bold" : "regular"} />
              }
              label="New chat"
              isActive={isHomeActive}
              onClick={navigateToChatHome}
            />
          </Box>

          {chatTasks.length > 0 && (
            <Box px="2" pt="3" pb="1">
              <Text
                as="div"
                className="font-medium text-(--gray-10) text-[11px] uppercase tracking-wide"
              >
                Recent chats
              </Text>
            </Box>
          )}

          {chatTasks.map((task) => {
            const isActive =
              chatView === "conversation" && activeChatId === task.id;
            return (
              <Box key={task.id}>
                <ChatItem
                  task={task}
                  isActive={isActive}
                  onSelect={() => navigateToChatConversation(task.id)}
                  onArchive={() => handleArchive(task.id)}
                  onContextMenu={(e) => void handleContextMenu(task, e)}
                />
              </Box>
            );
          })}
        </Flex>
      </ScrollArea>
    </Box>
  );
}
