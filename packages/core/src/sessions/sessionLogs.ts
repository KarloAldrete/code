import type { AcpMessage, Adapter, StoredLogEntry } from "@posthog/shared";
import { isJsonRpcRequest } from "@posthog/shared";

export interface ParsedSessionLogs {
  rawEntries: StoredLogEntry[];
  totalLineCount: number;
  parseFailureCount: number;
  sessionId?: string;
  adapter?: Adapter;
}

export function parseSessionLogContent(
  content: string,
  options: { onParseError?: (line: string) => void } = {},
): ParsedSessionLogs {
  const rawEntries: StoredLogEntry[] = [];
  let sessionId: string | undefined;
  let adapter: Adapter | undefined;
  let parseFailureCount = 0;
  const lines = content.trim().split("\n");

  for (const line of lines) {
    try {
      const stored = JSON.parse(line) as StoredLogEntry;
      rawEntries.push(stored);

      if (
        stored.type === "notification" &&
        stored.notification?.method?.endsWith("posthog/sdk_session")
      ) {
        const params = stored.notification.params as {
          sessionId?: string;
          sdkSessionId?: string;
          adapter?: Adapter;
        };
        if (params?.sessionId) sessionId = params.sessionId;
        else if (params?.sdkSessionId) sessionId = params.sdkSessionId;
        if (params?.adapter) adapter = params.adapter;
      }
    } catch {
      parseFailureCount += 1;
      options.onParseError?.(line);
    }
  }

  return {
    rawEntries,
    totalLineCount: lines.length,
    parseFailureCount,
    sessionId,
    adapter,
  };
}

/** Parse one ndjson line into a StoredLogEntry, extracting session metadata. */
function parseLogLine(
  line: string,
  acc: { sessionId?: string; adapter?: Adapter },
): StoredLogEntry | null {
  try {
    const stored = JSON.parse(line) as StoredLogEntry;
    if (
      stored.type === "notification" &&
      stored.notification?.method?.endsWith("posthog/sdk_session")
    ) {
      const params = stored.notification.params as {
        sessionId?: string;
        sdkSessionId?: string;
        adapter?: Adapter;
      };
      if (params?.sessionId) acc.sessionId = params.sessionId;
      else if (params?.sdkSessionId) acc.sessionId = params.sdkSessionId;
      if (params?.adapter) acc.adapter = params.adapter;
    }
    return stored;
  } catch {
    return null;
  }
}

/**
 * Non-blocking variant of `parseSessionLogContent`: parses the ndjson in
 * `chunkSize`-line slices, yielding control between slices via `yieldToHost`
 * so a 97k-line / ~420ms `JSON.parse` no longer freezes the renderer.
 *
 * `onChunk(entries, soFar)` fires after each parsed slice so callers can render
 * progressively. Produces byte-identical `rawEntries` to the sync parser (same
 * order, same parse-failure handling) — see sessionLogs.chunked.test.ts.
 */
export async function parseSessionLogContentChunked(
  content: string,
  options: {
    chunkSize?: number;
    onChunk?: (entries: StoredLogEntry[], soFar: number) => void;
    yieldToHost?: () => Promise<void>;
  } = {},
): Promise<ParsedSessionLogs> {
  const chunkSize = options.chunkSize ?? 1000;
  const yieldToHost =
    options.yieldToHost ?? (() => new Promise<void>((r) => setTimeout(r, 0)));

  const lines = content.trim().split("\n");
  const rawEntries: StoredLogEntry[] = [];
  const meta: { sessionId?: string; adapter?: Adapter } = {};
  let parseFailureCount = 0;

  for (let start = 0; start < lines.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, lines.length);
    const chunk: StoredLogEntry[] = [];
    for (let i = start; i < end; i++) {
      const stored = parseLogLine(lines[i], meta);
      if (stored === null) parseFailureCount += 1;
      else chunk.push(stored);
    }
    rawEntries.push(...chunk);
    options.onChunk?.(chunk, rawEntries.length);
    if (end < lines.length) await yieldToHost();
  }

  return {
    rawEntries,
    totalLineCount: lines.length,
    parseFailureCount,
    sessionId: meta.sessionId,
    adapter: meta.adapter,
  };
}

export function planSkippedPromptFilter(
  skipPolledPromptCount: number | undefined,
  events: AcpMessage[],
): { events: AcpMessage[]; remainingSkipCount: number } | null {
  if (!skipPolledPromptCount || skipPolledPromptCount <= 0) {
    return null;
  }

  const promptIdx = events.findIndex(
    (e) => isJsonRpcRequest(e.message) && e.message.method === "session/prompt",
  );
  if (promptIdx === -1) {
    return null;
  }

  const filtered = [...events];
  filtered.splice(promptIdx, 1);
  return { events: filtered, remainingSkipCount: skipPolledPromptCount - 1 };
}
