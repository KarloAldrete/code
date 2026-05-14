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
 * around nests instead of clipping through them.
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

    // Build the segment list. transitPath, when present, starts at the
    // sprite's known position (path[0]) and ends near the target — we walk
    // through every interior waypoint, then settle at (targetX, targetY).
    // The trailing target is added unconditionally so a stale/rounded last
    // waypoint never short-changes the final landing position.
    const segments: Vec2[] = [];
    if (transitPath && transitPath.length > 1) {
      for (let i = 1; i < transitPath.length; i++) {
        segments.push(transitPath[i]);
      }
    }
    const last = segments[segments.length - 1];
    if (!last || last.x !== targetX || last.y !== targetY) {
      segments.push({ x: targetX, y: targetY });
    }

    if (segments.length === 0) return;

    let cancelled = false;
    let xCtrl: AnimationPlaybackControls | null = null;
    let yCtrl: AnimationPlaybackControls | null = null;
    let started = false;
    let i = 0;

    const playSegment = () => {
      if (cancelled) return;
      if (i >= segments.length) {
        setIsWalking(false);
        return;
      }
      const seg = segments[i];
      const sx = motionX.get();
      const sy = motionY.get();
      const dx = seg.x - sx;
      const dy = seg.y - sy;
      const dist = Math.hypot(dx, dy);
      if (dist < 1) {
        i++;
        playSegment();
        return;
      }
      if (!started) {
        started = true;
        setIsWalking(true);
      }
      if (dx > 0) setFacing("right");
      else if (dx < 0) setFacing("left");
      const duration = dist / SPEED;
      xCtrl = animate(motionX, seg.x, { duration, ease: "linear" });
      yCtrl = animate(motionY, seg.y, {
        duration,
        ease: "linear",
        onComplete: () => {
          if (cancelled) return;
          i++;
          playSegment();
        },
      });
    };

    playSegment();

    return () => {
      cancelled = true;
      xCtrl?.stop();
      yCtrl?.stop();
      setIsWalking(false);
    };
  }, [targetX, targetY, transitPath, motionX, motionY]);

  return { motionX, motionY, isWalking, facing };
}
