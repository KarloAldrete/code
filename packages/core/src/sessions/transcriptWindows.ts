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
 * Compute the tail window over `content`: the tail's raw entries, whether older
 * lines remain, and the cursor (`windowStart`) the caller commits via
 * `setTranscriptWindow`. Pure — records nothing; `content` is not retained, so
 * older chunks are sliced from a fresh re-read via `takeOlderEntries`.
 */
export function computeTailWindow(content: string): {
  tail: StoredLogEntry[];
  hasOlder: boolean;
  windowStart: number;
} {
  const lines = content.trim().split("\n");
  const windowStart = Math.max(0, lines.length - TAIL_WINDOW_LINES);
  const tail = parseSessionLogContent(
    lines.slice(windowStart).join("\n"),
  ).rawEntries;
  return { tail, hasOlder: windowStart > 0, windowStart };
}

/**
 * Record the scrollback cursor for a freshly opened window. Kept separate from
 * `computeTailWindow` (which is pure) so the caller can register the cursor in
 * the SAME synchronous tick it commits the tail into `session.events` — a cursor
 * must never outlive a seed that a concurrency check ended up discarding, or a
 * later scroll-up would slice older lines against events it never rendered.
 */
export function setTranscriptWindow(
  taskRunId: string,
  windowStart: number,
): void {
  windows.set(taskRunId, { windowStart });
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
  // Pull older chunks until we have at least one renderable entry or reach the
  // top. A chunk can parse to zero entries (e.g. a run of non-event lines); if
  // we returned an empty slice while still reporting `hasOlder`, the caller
  // would prepend nothing and the UI's scrollback gate could never advance.
  let newStart = window.windowStart;
  let older: StoredLogEntry[] = [];
  while (newStart > 0 && older.length === 0) {
    const from = Math.max(0, newStart - count);
    older = parseSessionLogContent(
      lines.slice(from, newStart).join("\n"),
    ).rawEntries;
    newStart = from;
  }
  window.windowStart = newStart;
  return { older, hasOlder: newStart > 0 };
}

export function hasTranscriptWindow(taskRunId: string): boolean {
  return windows.has(taskRunId);
}

export function clearTranscriptWindow(taskRunId: string): void {
  windows.delete(taskRunId);
}
