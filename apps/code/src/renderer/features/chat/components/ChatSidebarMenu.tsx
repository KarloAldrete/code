import { SidebarItem } from "@features/sidebar/components/SidebarItem";
import { useTasks } from "@features/tasks/hooks/useTasks";
import { ChatCircleDots, Plus } from "@phosphor-icons/react";
import { ScrollArea } from "@posthog/quill";
import { Box, Flex, Text } from "@radix-ui/themes";
import { useNavigationStore } from "@stores/navigationStore";
import { useMemo } from "react";
import { useChatStore } from "../stores/chatStore";

export function ChatSidebarMenu() {
  const { data: tasks } = useTasks();
  const chatTaskIds = useChatStore((s) => s.chatTaskIds);
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
      .filter((t): t is NonNullable<typeof t> => !!t);
  }, [tasks, chatTaskIds]);

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
                <SidebarItem
                  depth={0}
                  icon={
                    <ChatCircleDots
                      size={16}
                      weight={isActive ? "fill" : "regular"}
                    />
                  }
                  label={task.title || "Untitled chat"}
                  isActive={isActive}
                  onClick={() => navigateToChatConversation(task.id)}
                />
              </Box>
            );
          })}
        </Flex>
      </ScrollArea>
    </Box>
  );
}
