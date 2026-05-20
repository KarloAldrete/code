import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as watcher from "@parcel/watcher";
import { inject, injectable, preDestroy } from "inversify";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { MAIN_TOKENS } from "../../di/tokens";
import { logger } from "../../utils/logger";
import { TypedEventEmitter } from "../../utils/typed-event-emitter";
import type { WatcherRegistryService } from "../watcher-registry/service";
import {
  type PlanAppendInput,
  type PlanResolveInput,
  PlansWatcherEvent,
  type PlansWatcherEvents,
  type Speaker,
} from "./schemas";

const log = logger.scope("plans-watcher");
const DEBOUNCE_MS = 100;
const WATCHER_ID = "plans-watcher:plans-dir";

/** Mirrors `getClaudePlansDir` in @posthog/agent — kept local to avoid a new subpath export. */
function getClaudePlansDir(): string {
  const configDir =
    process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude");
  return path.join(configDir, "plans");
}

/**
 * A thread is a contiguous markdown blockquote of lines like
 * `> [H]: …`, `> [A]: …`, or `> [resolved]` placed immediately after the
 * block it is anchored to (the user clicked `+` on the preceding paragraph
 * / heading / list item). We never need to identify a thread by an opaque
 * id — its anchor is the preceding block, located via verbatim text match.
 */
const THREAD_LINE_RE = /^\s*>\s*\[(H|A|resolved)\](?::\s*(.*))?$/;

export function isThreadLine(line: string): boolean {
  return THREAD_LINE_RE.test(line);
}

interface AstBlock {
  /** Verbatim source slice of this block. */
  text: string;
  /** 0-based line index immediately AFTER the block (insertion point). */
  endLine: number;
  /** True if this block is a `[H]:` / `[A]:` / `[resolved]` thread blockquote. */
  isThread: boolean;
}

interface MdNodeLike {
  type: string;
  children?: MdNodeLike[];
  position?: {
    start: { line: number; column: number; offset?: number };
    end: { line: number; column: number; offset?: number };
  };
  // For blockquote thread detection (definition nodes carry the label)
  label?: string;
  value?: string;
}

function isThreadBlockquote(node: MdNodeLike): boolean {
  if (node.type !== "blockquote" || !node.children?.length) return false;
  for (const child of node.children) {
    if (child.type === "definition") {
      if (child.label !== "H" && child.label !== "A") return false;
      continue;
    }
    if (child.type === "paragraph") {
      const text = (function getText(n: MdNodeLike): string {
        if (typeof n.value === "string") return n.value;
        return (n.children ?? []).map(getText).join("");
      })(child);
      const lines = text.split("\n");
      const allThread = lines.every(
        (l) => l.trim() === "" || /^\s*\[(H|A|resolved)\]/.test(l),
      );
      if (!allThread) return false;
      continue;
    }
    return false;
  }
  return true;
}

function parseAstBlocks(source: string): AstBlock[] {
  // Parse the file's top-level markdown structure to identify anchor
  // blocks the same way the renderer does. Doing this with `remark-parse`
  // means a fenced code block with a blank line — or a loose list with
  // blank lines between items — counts as ONE block, matching the
  // renderer's single gutter button for that block. Without AST parsing
  // we'd split such blocks on blank lines and fail to find an exact match.
  const tree = unified()
    .use(remarkParse)
    .parse(source) as unknown as MdNodeLike;

  const blocks: AstBlock[] = [];
  for (const child of tree.children ?? []) {
    const startOffset = child.position?.start.offset;
    const endOffset = child.position?.end.offset;
    if (typeof startOffset !== "number" || typeof endOffset !== "number") {
      continue;
    }
    const text = source.slice(startOffset, endOffset);
    const endLine = source.slice(0, endOffset).split("\n").length;
    blocks.push({
      text,
      endLine,
      isThread: isThreadBlockquote(child),
    });
  }
  return blocks;
}

export function findBlockInsertionLine(
  lines: string[],
  blockText: string,
  occurrence = 0,
): number | null {
  const target = blockText.trim();
  if (!target) return null;

  const source = lines.join("\n");
  let remainingToSkip = occurrence;

  for (const block of parseAstBlocks(source)) {
    if (block.isThread) continue;
    if (block.text.trim() !== target) continue;
    if (remainingToSkip === 0) return block.endLine;
    remainingToSkip -= 1;
  }
  return null;
}

/**
 * After inserting or extending a thread blockquote, ensure the line right
 * after the thread is blank (or the file ends there). Without this guard,
 * a non-blank line immediately following `> [H]: …` becomes lazy
 * continuation of the blockquote under CommonMark and `remarkPlanThreads`
 * stops recognising it as a pure `[H]/[A]/[resolved]` thread.
 *
 * @param threadEnd 0-based index immediately after the last thread line
 */
function ensureBlankAfterThread(lines: string[], threadEnd: number): string[] {
  if (threadEnd >= lines.length) return lines;
  if (lines[threadEnd].trim() === "") return lines;
  return [...lines.slice(0, threadEnd), "", ...lines.slice(threadEnd)];
}

export function findExistingThreadRange(
  lines: string[],
  startLine: number,
): { start: number; end: number } | null {
  // Skip blank lines immediately after the anchor block.
  let cursor = startLine;
  while (cursor < lines.length && lines[cursor].trim() === "") cursor += 1;
  if (cursor >= lines.length || !isThreadLine(lines[cursor])) return null;

  const threadStart = cursor;
  while (cursor < lines.length && isThreadLine(lines[cursor])) cursor += 1;
  return { start: threadStart, end: cursor };
}

export function formatThreadLine(speaker: Speaker, message: string): string {
  // Collapse newlines so the message lives in a single blockquote line — the
  // agent and parser both expect one line per message.
  const oneLine = message.replace(/\s+/g, " ").trim();
  return `> [${speaker}]: ${oneLine}`;
}

@injectable()
export class PlansWatcherService extends TypedEventEmitter<PlansWatcherEvents> {
  private started = false;
  private debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    @inject(MAIN_TOKENS.WatcherRegistryService)
    private watcherRegistry: WatcherRegistryService,
  ) {
    super();
  }

  @preDestroy()
  async destroy(): Promise<void> {
    for (const timer of this.debounceTimers.values()) clearTimeout(timer);
    this.debounceTimers.clear();
    await this.stop();
  }

  /** Idempotent — starts watching the plans directory if not already. */
  async ensureStarted(): Promise<void> {
    if (this.started) return;
    this.started = true;

    const plansDir = getClaudePlansDir();
    try {
      await fs.mkdir(plansDir, { recursive: true });
    } catch (err) {
      log.warn(`Failed to ensure plans dir exists at ${plansDir}:`, err);
    }

    try {
      const subscription = await watcher.subscribe(plansDir, (err, events) => {
        if (this.watcherRegistry.isShutdown) return;
        if (err) {
          log.warn("Plans watcher error:", err);
          return;
        }
        for (const event of events) {
          this.queueEvent(event);
        }
      });
      this.watcherRegistry.register(WATCHER_ID, subscription);
      log.info(`Watching plans dir: ${plansDir}`);
    } catch (err) {
      log.error(`Failed to start plans watcher at ${plansDir}:`, err);
      this.started = false;
    }
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    await this.watcherRegistry.unregister(WATCHER_ID);
  }

  async readPlan(filePath: string): Promise<string | null> {
    if (!this.isPlanFilePath(filePath)) {
      throw new Error(`Refusing to read non-plan file: ${filePath}`);
    }
    try {
      return await fs.readFile(filePath, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
      throw err;
    }
  }

  async appendThreadMessage(input: PlanAppendInput): Promise<void> {
    if (!this.isPlanFilePath(input.filePath)) {
      throw new Error(`Refusing to write non-plan file: ${input.filePath}`);
    }
    const original = (await this.readPlan(input.filePath)) ?? "";
    const lines = original.split("\n");
    const insertionLine = findBlockInsertionLine(
      lines,
      input.blockText,
      input.occurrence,
    );
    if (insertionLine === null) {
      throw new Error("Plan thread anchor block not found in file");
    }

    const newLine = formatThreadLine(input.speaker, input.message);
    const existing = findExistingThreadRange(lines, insertionLine);

    let next: string[];
    let threadEnd: number;
    if (existing) {
      // Extend the existing thread. If the last line is `> [resolved]`, insert
      // before it so the resolved marker stays terminal.
      const insertAt =
        lines[existing.end - 1]?.trim() === "> [resolved]"
          ? existing.end - 1
          : existing.end;
      next = [...lines.slice(0, insertAt), newLine, ...lines.slice(insertAt)];
      threadEnd = existing.end + 1;
    } else {
      // Create a new thread immediately after the anchor block. Ensure there
      // is exactly one blank line between the block and the thread.
      const prefix = lines.slice(0, insertionLine);
      const suffix = lines.slice(insertionLine);
      const needsBlank = prefix.length > 0 && prefix[prefix.length - 1] !== "";
      next = [...prefix, ...(needsBlank ? [""] : []), newLine, ...suffix];
      threadEnd = prefix.length + (needsBlank ? 1 : 0) + 1;
    }

    next = ensureBlankAfterThread(next, threadEnd);
    await this.atomicWrite(input.filePath, next.join("\n"));
  }

  async resolveThread(input: PlanResolveInput): Promise<void> {
    if (!this.isPlanFilePath(input.filePath)) {
      throw new Error(`Refusing to write non-plan file: ${input.filePath}`);
    }
    const original = (await this.readPlan(input.filePath)) ?? "";
    const lines = original.split("\n");
    const insertionLine = findBlockInsertionLine(
      lines,
      input.blockText,
      input.occurrence,
    );
    if (insertionLine === null) {
      throw new Error("Plan thread anchor block not found in file");
    }

    const existing = findExistingThreadRange(lines, insertionLine);
    if (!existing) {
      throw new Error("No thread to resolve under that block");
    }
    if (lines[existing.end - 1]?.trim() === "> [resolved]") {
      return; // already resolved
    }

    let next = [
      ...lines.slice(0, existing.end),
      "> [resolved]",
      ...lines.slice(existing.end),
    ];
    next = ensureBlankAfterThread(next, existing.end + 1);
    await this.atomicWrite(input.filePath, next.join("\n"));
  }

  private isPlanFilePath(filePath: string): boolean {
    const resolved = path.resolve(filePath);
    const plansDir = path.resolve(getClaudePlansDir());
    return resolved.startsWith(plansDir + path.sep) && resolved.endsWith(".md");
  }

  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tmp, content, "utf8");
    await fs.rename(tmp, filePath);
  }

  private queueEvent(event: watcher.Event): void {
    if (!event.path.endsWith(".md")) return;

    const key = event.path;
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);
    this.debounceTimers.set(
      key,
      setTimeout(() => {
        this.debounceTimers.delete(key);
        if (event.type === "delete") {
          this.emit(PlansWatcherEvent.PlanFileDeleted, {
            filePath: event.path,
          });
        } else {
          this.emit(PlansWatcherEvent.PlanFileChanged, {
            filePath: event.path,
          });
        }
      }, DEBOUNCE_MS),
    );
  }
}
