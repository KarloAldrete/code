import type { AgentSession } from "@features/sessions/stores/sessionStore";
import { isJsonRpcNotification } from "@shared/types/session-events";

function extractPlainText(node: unknown): string {
  if (typeof node === "string") return node;
  if (!node || typeof node !== "object") return "";
  const obj = node as Record<string, unknown>;
  if (typeof obj.text === "string") return obj.text;
  if (Array.isArray(obj.content)) {
    return obj.content.map(extractPlainText).join("");
  }
  return "";
}

export function flattenChatTranscript(
  session: AgentSession | undefined,
): string {
  if (!session?.events?.length) return "";
  const parts: string[] = [];
  for (const event of session.events) {
    const msg = event.message;
    if (!isJsonRpcNotification(msg)) continue;
    if (msg.method !== "session/update") continue;
    const update = (msg.params as { update?: Record<string, unknown> })?.update;
    if (!update) continue;
    if (update.sessionUpdate === "user_message_chunk") {
      const text = extractPlainText(update.content);
      if (text.trim()) parts.push(`**You:** ${text.trim()}`);
    } else if (update.sessionUpdate === "agent_message_chunk") {
      const text = extractPlainText(update.content);
      if (text.trim()) parts.push(`**Assistant:** ${text.trim()}`);
    }
  }
  return parts.join("\n\n");
}
