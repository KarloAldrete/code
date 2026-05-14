import {
  type AnimationPlaybackControls,
  animate,
  type MotionValue,
  useMotionValue,
} from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { Vec2 } from "../utils/pathfinding";

const SPEED = 120;

interface WalkToResult {
  motionX: MotionValue<number>;
  motionY: MotionValue<number>;
  isWalking: boolean;
  facing: "left" | "right";
}

/**
 * Tweens a sprite from its current position to `(targetX, targetY)`. If
 * `transitPath` is provided, it's treated as an ordered list of waypoints to
 * walk through *before* settling at the target — used so hoglets visibly route
 * around nests instead of clipping through them. The first/last points of the
 * path are expected to be the current pos and target respectively; we skip the
 * leading point because the sprite is already there.
 */
export function useWalkTo(
  targetX: number,
  targetY: number,
  transitPath?: Vec2[],
): WalkToResult {
  const motionX = useMotionValue(targetX);
  const motionY = useMotionValue(targetY);
  const [isWalking, setIsWalking] = useState(false);
  const [facing, setFacing] = useState<"left" | "right">("right");
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      motionX.set(targetX);
      motionY.set(targetY);
      return;
    }

    // Build the segment list: if a transit path is given, walk every interior
    // waypoint and end at (targetX, targetY); otherwise just the target.
    const segments: Vec2[] = [];
    if (transitPath && transitPath.length > 1) {
      // Drop the first point: sprite is already at (or near) it. Drop the
      // last if it duplicates target so we don't kick off a zero-length tween.
      for (let i = 1; i < transitPath.length; i++) {
        const p = transitPath[i];
        if (i === transitPath.length - 1 && p.x === targetX && p.y === targetY)
          continue;
        segments.push(p);
      }
    }
    segments.push({ x: targetX, y: targetY });

    let cancelled = false;
    let xCtrl: AnimationPlaybackControls | null = null;
    let yCtrl: AnimationPlaybackControls | null = null;

    const run = async () => {
      let started = false;
      for (const seg of segments) {
        if (cancelled) return;
        const sx = motionX.get();
        const sy = motionY.get();
        const dx = seg.x - sx;
        const dy = seg.y - sy;
        const dist = Math.hypot(dx, dy);
        if (dist < 1) continue;
        if (!started) {
          started = true;
          setIsWalking(true);
        }
        if (dx > 0) setFacing("right");
        else if (dx < 0) setFacing("left");
        const duration = dist / SPEED;
        xCtrl = animate(motionX, seg.x, { duration, ease: "linear" });
        yCtrl = animate(motionY, seg.y, { duration, ease: "linear" });
        try {
          await Promise.all([xCtrl, yCtrl]);
        } catch {
          // animate() throws on stop(); cancellation handled by the cleanup.
          return;
        }
      }
      if (!cancelled) setIsWalking(false);
    };

    void run();

    return () => {
      cancelled = true;
      xCtrl?.stop();
      yCtrl?.stop();
      setIsWalking(false);
    };
  }, [targetX, targetY, transitPath, motionX, motionY]);

  return { motionX, motionY, isWalking, facing };
}
