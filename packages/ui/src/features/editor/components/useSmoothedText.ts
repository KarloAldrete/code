import { useEffect, useRef, useState } from "react";

// Reveal the backlog over ~this many frames. The step scales with the backlog,
// so it converges in roughly this many frames regardless of how big a burst
// arrives — small bursts trickle, big bursts catch up fast.
const SMOOTHING_FRAMES = 6;
const MIN_REVEAL = 2;

/**
 * Smoothly reveals `target` a slice per animation frame instead of jumping to
 * whatever arrived. Streamed tokens land in irregular bursts (1–4 words, then a
 * pause); painting them verbatim looks choppy. This decouples arrival from
 * paint so the text flows at a steady ~60fps "typewriter" cadence while never
 * lagging far behind — the reveal step is proportional to the remaining
 * backlog, so it catches up within ~SMOOTHING_FRAMES frames.
 *
 * Append-only by design: a shorter `target` (a brand-new message reusing this
 * hook instance) snaps instantly and we never hide already-revealed text.
 */
export function useSmoothedText(target: string): string {
  const [, forceRender] = useState(0);
  const shownLenRef = useRef(target.length);
  const targetRef = useRef(target);
  targetRef.current = target;
  const rafRef = useRef<number | null>(null);

  // Snap when the text shrinks (new/replaced message) — never un-reveal text.
  if (target.length < shownLenRef.current) {
    shownLenRef.current = target.length;
  }

  useEffect(() => {
    const tick = () => {
      const tgtLen = targetRef.current.length;
      const remaining = tgtLen - shownLenRef.current;
      if (remaining <= 0) {
        rafRef.current = null;
        return;
      }
      const step = Math.max(
        MIN_REVEAL,
        Math.ceil(remaining / SMOOTHING_FRAMES),
      );
      const shown = shownLenRef.current;
      let next = Math.min(tgtLen, shown + step);
      if (next < tgtLen) {
        // Stop at a whitespace boundary when possible so words (and inline
        // markdown tokens like **bold**) reveal whole instead of mid-token.
        const text = targetRef.current;
        const boundary = Math.max(
          text.lastIndexOf(" ", next),
          text.lastIndexOf("\n", next),
        );
        if (boundary > shown) next = boundary + 1;
      }
      shownLenRef.current = next;
      forceRender((n) => (n + 1) % 1_000_000);
      rafRef.current = requestAnimationFrame(tick);
    };
    if (rafRef.current === null && shownLenRef.current < target.length) {
      rafRef.current = requestAnimationFrame(tick);
    }
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target]);

  return shownLenRef.current >= targetRef.current.length
    ? targetRef.current
    : targetRef.current.slice(0, shownLenRef.current);
}
