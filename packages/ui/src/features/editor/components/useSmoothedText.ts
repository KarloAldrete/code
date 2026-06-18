import { useEffect, useRef, useState } from "react";

// Reveal at a steady character rate (~120 chars/sec) rather than an adaptive
// one, so the cadence reads as even typing instead of speeding up to clear a
// backlog. Matches the feel of #2685. See https://upstash.com/blog/smooth-streaming.
const DEFAULT_CHARS_PER_SECOND = 120;
// Past this backlog we stop easing and snap, so a large buffered chunk (e.g. a
// reconnect replaying a long message) never crawls.
const MAX_LAG_CHARS = 600;

/**
 * Pure easing: the next reveal length given how much time elapsed since the last
 * frame. Timer-free so it's unit-testable. Never exceeds `target`, never goes
 * backwards, and snaps when too far behind to ease smoothly.
 */
export function nextRevealLength(
  current: number,
  target: number,
  elapsedMs: number,
  charsPerSecond: number,
): number {
  if (current >= target) return target;
  if (target - current > MAX_LAG_CHARS) return target;
  const step = Math.ceil((charsPerSecond * elapsedMs) / 1000);
  return Math.min(target, current + Math.max(step, 1));
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Smoothly reveals `target` a few characters per frame at a steady rate instead
 * of jumping whenever streamed tokens arrive in bursts, so the text reads as
 * even typing. Text already present on mount shows immediately (no replay); the
 * reveal snaps when the source is replaced with a shorter value (a new message)
 * or the user prefers reduced motion.
 */
export function useSmoothedText(
  target: string,
  charsPerSecond = DEFAULT_CHARS_PER_SECOND,
): string {
  const [, forceRender] = useState(0);
  const shownLenRef = useRef(target.length);
  const targetRef = useRef(target);
  targetRef.current = target;
  const lastTsRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // New/replaced (shorter) message: snap, and never hide already-shown text.
  if (target.length < shownLenRef.current) {
    shownLenRef.current = target.length;
  }

  useEffect(() => {
    if (prefersReducedMotion()) {
      if (shownLenRef.current !== targetRef.current.length) {
        shownLenRef.current = targetRef.current.length;
        forceRender((n) => (n + 1) % 1_000_000);
      }
      return;
    }
    // Kick the reveal loop only if it's idle. While running it reads the latest
    // target each frame (via ref), so it keeps a steady wall-clock rate across
    // token appends instead of restarting — and resetting its clock — per token.
    if (rafRef.current === null && shownLenRef.current < target.length) {
      lastTsRef.current = null;
      const tick = (ts: number) => {
        const last = lastTsRef.current ?? ts;
        lastTsRef.current = ts;
        shownLenRef.current = nextRevealLength(
          shownLenRef.current,
          targetRef.current.length,
          ts - last,
          charsPerSecond,
        );
        forceRender((n) => (n + 1) % 1_000_000);
        if (shownLenRef.current < targetRef.current.length) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          rafRef.current = null;
          lastTsRef.current = null;
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [target, charsPerSecond]);

  // Cancel any in-flight frame on unmount (kept separate so token appends don't
  // tear down the running loop).
  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  return shownLenRef.current >= targetRef.current.length
    ? targetRef.current
    : targetRef.current.slice(0, shownLenRef.current);
}
