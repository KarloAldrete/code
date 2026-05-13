import { useNavigationStore } from "@stores/navigationStore";
import { ChatConversation } from "./ChatConversation";
import { ChatHome } from "./ChatHome";

export function ChatView() {
  const chatView = useNavigationStore((s) => s.chatView);
  const activeChatId = useNavigationStore((s) => s.activeChatId);

  if (chatView === "conversation" && activeChatId) {
    return <ChatConversation key={activeChatId} chatId={activeChatId} />;
  }
  return <ChatHome />;
}
