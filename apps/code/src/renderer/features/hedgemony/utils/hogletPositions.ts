import type { Hoglet, Nest } from "@main/services/hedgemony/schemas";
import { WILD_BUCKET } from "../stores/hogletStore";

const WILD_RING_INNER = 130;
const WILD_RING_THICKNESS = 90;
const BROOD_RADIUS = 92;

function hashToUnit(id: string, seed: number): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < id.length; i++) {
    h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function wildHogletPosition(hogletId: string): { x: number; y: number } {
  const angle = hashToUnit(hogletId, 0) * Math.PI * 2;
  const radius =
    WILD_RING_INNER + hashToUnit(hogletId, 7) * WILD_RING_THICKNESS;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}

export function broodHogletPosition(
  index: number,
  total: number,
  origin: { x: number; y: number },
): { x: number; y: number } {
  const safeTotal = Math.max(total, 1);
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / safeTotal;
  return {
    x: origin.x + Math.cos(angle) * BROOD_RADIUS,
    y: origin.y + Math.sin(angle) * BROOD_RADIUS,
  };
}

function sortByCreated(hoglets: Hoglet[]): Hoglet[] {
  return [...hoglets].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export interface HogletWorldPosition {
  hogletId: string;
  x: number;
  y: number;
}

/**
 * Compute the on-map world position for every hoglet currently rendered on the
 * surface — wild flock + nest broods. Mirrors the layout logic in
 * `WildHogletFlock` and `NestBroodCluster` so callers (e.g. box-select) can
 * hit-test against the same coordinates the user sees. Signal-staging hoglets
 * live in the holding panel, not on the map, so they're excluded.
 */
export function collectHogletWorldPositions(
  nests: Nest[],
  byBucket: Record<string, Hoglet[]>,
  overrides: Record<string, { x: number; y: number }>,
): HogletWorldPosition[] {
  const out: HogletWorldPosition[] = [];

  const wild = byBucket[WILD_BUCKET] ?? [];
  for (const hoglet of sortByCreated(wild)) {
    const override = overrides[hoglet.id];
    const pos = override ?? wildHogletPosition(hoglet.id);
    out.push({ hogletId: hoglet.id, x: pos.x, y: pos.y });
  }

  for (const nest of nests) {
    const brood = byBucket[nest.id] ?? [];
    const ordered = sortByCreated(brood);
    ordered.forEach((hoglet, index) => {
      const override = overrides[hoglet.id];
      const pos =
        override ??
        broodHogletPosition(index, ordered.length, {
          x: nest.mapX,
          y: nest.mapY,
        });
      out.push({ hogletId: hoglet.id, x: pos.x, y: pos.y });
    });
  }

  return out;
}
