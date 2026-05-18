import { isNotification, POSTHOG_NOTIFICATIONS } from "@posthog/shared";
import type { AcpMessage } from "@shared/types/session-events";

const TERMINAL_STOP_REASON = "end_turn";

export function extractTerminalAssistantOutput(
  events: AcpMessage[],
): string | null {
  const turnCompleteIndex = findLastTerminalTurnCompleteIndex(events);
  if (turnCompleteIndex === -1) return null;

  let turnStartIndex = -1;
  for (let index = turnCompleteIndex - 1; index >= 0; index--) {
    const message = events[index].message;
    if (
      "method" in message &&
      isNotification(message.method, POSTHOG_NOTIFICATIONS.TURN_COMPLETE)
    ) {
      turnStartIndex = index;
      break;
    }
  }

  const messages = collectAssistantText(
    events.slice(turnStartIndex + 1, turnCompleteIndex),
  );
  const body = messages.join("\n\n").trim();
  return body.length > 0 ? body : null;
}

export function hasTurnComplete(events: AcpMessage[]): boolean {
  return events.some((event) => {
    const message = event.message;
    return (
      "method" in message &&
      isNotification(message.method, POSTHOG_NOTIFICATIONS.TURN_COMPLETE)
    );
  });
}

export function looksLikeHogletFinalOutput(value: string): boolean {
  return [
    /\bverification complete\b/i,
    /\b(?:done|complete|completed|finished)\b/i,
    /\bsummary\b/i,
    /\bfindings?\b/i,
    /\bno regressions?\b/i,
    /\ball (?:tests|checks|child PRs)\b.*\b(?:pass|clean|open)\b/i,
  ].some((pattern) => pattern.test(value));
}

function findLastTerminalTurnCompleteIndex(events: AcpMessage[]): number {
  for (let index = events.length - 1; index >= 0; index--) {
    const message = events[index].message;
    if (
      "method" in message &&
      isNotification(message.method, POSTHOG_NOTIFICATIONS.TURN_COMPLETE)
    ) {
      const params = message.params as { stopReason?: unknown } | undefined;
      return params?.stopReason === TERMINAL_STOP_REASON ? index : -1;
    }
  }
  return -1;
}

function collectAssistantText(events: AcpMessage[]): string[] {
  const segments: string[] = [];
  let chunkBuffer = "";

  const flushChunks = () => {
    const text = chunkBuffer.trim();
    if (text) {
      segments.push(text);
    }
    chunkBuffer = "";
  };

  for (const event of events) {
    const message = event.message;
    if (!("method" in message) || message.method !== "session/update") {
      flushChunks();
      continue;
    }

    const params = message.params as
      | {
          update?: {
            sessionUpdate?: unknown;
            content?: { type?: unknown; text?: unknown };
            message?: unknown;
          };
        }
      | undefined;
    const update = params?.update;
    if (!update) {
      flushChunks();
      continue;
    }

    const sessionUpdate = update?.sessionUpdate;

    if (sessionUpdate === "agent_message_chunk") {
      const text = getTextFromUpdate(update);
      if (text) {
        chunkBuffer += text;
      }
      continue;
    }

    flushChunks();

    if (sessionUpdate === "agent_message") {
      const text = getTextFromUpdate(update);
      if (text) {
        segments.push(text.trim());
      }
    }
  }

  flushChunks();
  return segments;
}

function getTextFromUpdate(update: {
  content?: { type?: unknown; text?: unknown };
  message?: unknown;
}): string | null {
  if (
    update.content?.type === "text" &&
    typeof update.content.text === "string"
  ) {
    return update.content.text;
  }

  if (typeof update.message === "string") {
    return update.message;
  }

  return null;
}
