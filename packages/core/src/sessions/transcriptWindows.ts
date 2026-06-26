import type { StoredLogEntry } from "@posthog/shared";
import { parseSessionLogContent } from "./sessionLogs";

/**
 * Scrollback windows for open transcripts. A huge session opens with only its
 * tail parsed + rendered (instant); the rest of the ndjson lines stay here as
 * raw text, parsed on demand when the user scrolls toward the top. This keeps
 * open cost O(visible) instead of O(history).
 *
 * Held outside the immer session store on purpose: this is bulk, non-reactive
 * data (one entry can be 100k+ line strings). It's cleared alongside the
 * session's events — by `evictEvents` (inactive-session reclaim), on teardown,
 * and replaced wholesale when a transcript is re-opened.
 */
interface TranscriptWindow {
  /** All ndjson lines of the log. */
  lines: string[];
  /** Index of the first line currently materialised into `session.events`. */
  windowStart: number;
}

const windows = new Map<string, TranscriptWindow>();

/** Lines materialised on first open / refocus. Tuned to fill a viewport + overscan. */
export const TAIL_WINDOW_LINES = 1000;
/** Lines pulled in per scroll-toward-top load. */
export const OLDER_CHUNK_LINES = 1000;

/**
 * Open a window over `content`, returning the tail's raw entries plus whether
 * older lines remain. Stores the lines for later `takeOlderEntries` calls.
 */
export function openTranscriptWindow(
  taskRunId: string,
  content: string,
): { tail: StoredLogEntry[]; hasOlder: boolean } {
  const lines = content.trim().split("\n");
  const windowStart = Math.max(0, lines.length - TAIL_WINDOW_LINES);
  windows.set(taskRunId, { lines, windowStart });
  const tail = parseSessionLogContent(
    lines.slice(windowStart).join("\n"),
  ).rawEntries;
  return { tail, hasOlder: windowStart > 0 };
}

/**
 * Parse and return the next older chunk, advancing the window. Returns null
 * when there's no window or nothing older remains.
 */
export function takeOlderEntries(
  taskRunId: string,
  count = OLDER_CHUNK_LINES,
): { older: StoredLogEntry[]; hasOlder: boolean } | null {
  const window = windows.get(taskRunId);
  if (!window || window.windowStart === 0) return null;
  const newStart = Math.max(0, window.windowStart - count);
  const older = parseSessionLogContent(
    window.lines.slice(newStart, window.windowStart).join("\n"),
  ).rawEntries;
  window.windowStart = newStart;
  return { older, hasOlder: newStart > 0 };
}

export function hasTranscriptWindow(taskRunId: string): boolean {
  return windows.has(taskRunId);
}

export function clearTranscriptWindow(taskRunId: string): void {
  windows.delete(taskRunId);
}
