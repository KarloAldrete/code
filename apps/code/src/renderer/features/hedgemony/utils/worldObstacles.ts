import type { Nest } from "@main/services/hedgemony/schemas";
import {
  HEDGEHOUSE_MAP_X,
  HEDGEHOUSE_MAP_Y,
} from "../components/HedgehouseSprite";
import type { Obstacle } from "./pathfinding";

// Shared collision radii for everything that should block walking — kept here
// so both the builder coordinator and the hoglet move handler agree on what
// is solid. NEST is smaller than the visible sprite (140px / 2 = 70) because
// agents inflate by their own radius during pathfinding; the additive sum is
// what determines apparent clearance.
export const NEST_OBSTACLE_RADIUS = 56;
// The Hedgehouse is the biggest structure on the map (220px). Without this
// entry, agents walked straight through it — pathfinding was added before
// the Hedgehouse existed and never picked it up.
export const HEDGEHOUSE_OBSTACLE_RADIUS = 90;

interface WorldObstacleOptions {
  /** A nest the builder is en-route to construct. Not in `nests` yet, but
   * needs to be treated as solid so the builder snaps to the perimeter
   * instead of standing on top of the eventual sprite. */
  pendingNest?: Nest | null;
}

export function worldObstacles(
  nests: Nest[],
  { pendingNest }: WorldObstacleOptions = {},
): Obstacle[] {
  const obstacles: Obstacle[] = nests.map((nest) => ({
    x: nest.mapX,
    y: nest.mapY,
    radius: NEST_OBSTACLE_RADIUS,
  }));
  if (pendingNest) {
    obstacles.push({
      x: pendingNest.mapX,
      y: pendingNest.mapY,
      radius: NEST_OBSTACLE_RADIUS,
    });
  }
  obstacles.push({
    x: HEDGEHOUSE_MAP_X,
    y: HEDGEHOUSE_MAP_Y,
    radius: HEDGEHOUSE_OBSTACLE_RADIUS,
  });
  return obstacles;
}
