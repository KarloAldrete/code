import type { StoredLogEntry } from "@posthog/shared";
import { parseSessionLogContent } from "./sessionLogs";

/**
 * Scrollback windows for open transcripts. A huge session opens with only its
 * tail parsed + rendered (instant); the rest of the ndjson loads on demand when
 * the user scrolls toward the top. This keeps open cost O(visible), not
 * O(history).
 *
 * We deliberately retain only the window *cursor* here — not the log text. An
 * earlier version cached every ndjson line as raw strings; a production memory
 * benchmark showed that pinned ~110MB+ per open transcript (the renderer heap of
 * one 48k-event session was ~270MB active vs ~50MB with the cursor-only window),
 * and it compounded across tasks in Command Center / "ADHD mode". Re-reading the
 * log from disk on a scroll-up is cheap — the OS page cache serves it in ~ms, and
 * scroll-up is user-initiated and infrequent — so we trade a little latency on a
 * rare action for a large, always-on memory win. The fetch itself lives in the
 * caller (`SessionService.loadOlderEvents`), which already knows how to read the
 * ndjson (`logs.readLocalLogs`); this module just slices and parses it.
 */
interface TranscriptWindow {
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
 * older lines remain. Stores only the window cursor — `content` is not retained;
 * older chunks are sliced from a fresh re-read via `takeOlderEntries`.
 */
export function openTranscriptWindow(
  taskRunId: string,
  content: string,
): { tail: StoredLogEntry[]; hasOlder: boolean } {
  const lines = content.trim().split("\n");
  const windowStart = Math.max(0, lines.length - TAIL_WINDOW_LINES);
  windows.set(taskRunId, { windowStart });
  const tail = parseSessionLogContent(
    lines.slice(windowStart).join("\n"),
  ).rawEntries;
  return { tail, hasOlder: windowStart > 0 };
}

/**
 * Parse and return the next older chunk, advancing the window. The caller passes
 * freshly re-read log `content` (older lines are start-indexed and append-stable,
 * so a grown log still slices correctly). Returns null when there's no window or
 * nothing older remains.
 */
export function takeOlderEntries(
  taskRunId: string,
  content: string,
  count = OLDER_CHUNK_LINES,
): { older: StoredLogEntry[]; hasOlder: boolean } | null {
  const window = windows.get(taskRunId);
  if (!window || window.windowStart === 0) return null;
  const lines = content.trim().split("\n");
  const newStart = Math.max(0, window.windowStart - count);
  const older = parseSessionLogContent(
    lines.slice(newStart, window.windowStart).join("\n"),
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
