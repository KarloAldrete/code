import { memo, useMemo } from "react";
import type { Components } from "react-markdown";
import { MarkdownRenderer } from "./MarkdownRenderer";
import {
  hasOpenCodeFence,
  parseOpenFence,
  splitMarkdownBlocks,
} from "./splitMarkdownBlocks";

interface StreamingMarkdownProps {
  content: string;
  componentsOverride?: Partial<Components>;
}

/**
 * Renders streamed agent markdown without re-parsing the whole message on every
 * token. The text is split into top-level blocks: completed blocks keep a stable
 * string so the memoized {@link MarkdownRenderer} skips re-parsing them, and only
 * the growing tail is re-parsed — turning the per-token cost from O(message) into
 * O(last block).
 *
 * While the tail sits inside an unterminated code fence it's shown as plain
 * monospace (no markdown parse, no syntax highlighting); the heavy highlight runs
 * once, when the fence closes and the block freezes. Completed messages should
 * use {@link MarkdownRenderer} directly for a single, fully-correct parse.
 */
export const StreamingMarkdown = memo(function StreamingMarkdown({
  content,
  componentsOverride,
}: StreamingMarkdownProps) {
  const blocks = useMemo(() => splitMarkdownBlocks(content), [content]);
  const lastIndex = blocks.length - 1;

  return (
    <>
      {blocks.map((block, index) => {
        const key = `b${index}`;
        if (index === lastIndex && hasOpenCodeFence(block)) {
          const { before, code } = parseOpenFence(block);
          return (
            <div key={key}>
              {before.trim() ? (
                <MarkdownRenderer
                  content={before}
                  componentsOverride={componentsOverride}
                />
              ) : null}
              <pre className="overflow-x-auto rounded-md border border-border bg-gray-3 p-2 text-[13px] leading-relaxed">
                <code>{code}</code>
              </pre>
            </div>
          );
        }
        return (
          <MarkdownRenderer
            key={key}
            content={block}
            componentsOverride={componentsOverride}
          />
        );
      })}
    </>
  );
});
