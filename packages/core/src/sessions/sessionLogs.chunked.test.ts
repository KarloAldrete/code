import { describe, expect, it, vi } from "vitest";
import {
  parseSessionLogContent,
  parseSessionLogContentChunked,
} from "./sessionLogs";

function line(obj: unknown): string {
  return JSON.stringify(obj);
}

function makeContent(n: number): string {
  const lines: string[] = [
    line({
      type: "notification",
      notification: {
        method: "_posthog/sdk_session",
        params: { sessionId: "sess-1", adapter: "claude" },
      },
    }),
  ];
  for (let i = 0; i < n; i++) {
    lines.push(
      line({
        type: "notification",
        notification: {
          method: "session/update",
          params: {
            update: { sessionUpdate: "agent_message_chunk", text: `t${i}` },
          },
        },
      }),
    );
  }
  return lines.join("\n");
}

const immediateYield = () => Promise.resolve();

describe("parseSessionLogContentChunked", () => {
  it("produces output identical to the sync parser", async () => {
    const content = makeContent(2500); // spans multiple chunks
    const sync = parseSessionLogContent(content);
    const chunked = await parseSessionLogContentChunked(content, {
      chunkSize: 1000,
      yieldToHost: immediateYield,
    });

    expect(chunked.rawEntries).toEqual(sync.rawEntries);
    expect(chunked.totalLineCount).toBe(sync.totalLineCount);
    expect(chunked.parseFailureCount).toBe(sync.parseFailureCount);
    expect(chunked.sessionId).toBe(sync.sessionId);
    expect(chunked.adapter).toBe(sync.adapter);
  });

  it("matches the sync parser on corrupt/partial lines", async () => {
    const content = `${makeContent(10)}\n{not valid json\n${line({ type: "notification", notification: { method: "x" } })}`;
    const sync = parseSessionLogContent(content);
    const chunked = await parseSessionLogContentChunked(content, {
      chunkSize: 4,
      yieldToHost: immediateYield,
    });

    expect(chunked.rawEntries).toEqual(sync.rawEntries);
    expect(chunked.parseFailureCount).toBe(sync.parseFailureCount);
    expect(chunked.parseFailureCount).toBeGreaterThan(0);
  });

  it("streams chunks progressively and yields between them", async () => {
    const content = makeContent(2500);
    const chunkSizes: number[] = [];
    const yieldSpy = vi.fn(() => Promise.resolve());

    await parseSessionLogContentChunked(content, {
      chunkSize: 1000,
      onChunk: (entries) => chunkSizes.push(entries.length),
      yieldToHost: yieldSpy,
    });

    // 2501 lines / 1000 → 3 chunks (1000, 1000, 501); yields between, not after last.
    expect(chunkSizes.length).toBe(3);
    expect(yieldSpy).toHaveBeenCalledTimes(2);
  });

  it("handles empty content", async () => {
    const sync = parseSessionLogContent("");
    const chunked = await parseSessionLogContentChunked("", {
      yieldToHost: immediateYield,
    });
    expect(chunked.rawEntries).toEqual(sync.rawEntries);
    expect(chunked.totalLineCount).toBe(sync.totalLineCount);
  });
});
