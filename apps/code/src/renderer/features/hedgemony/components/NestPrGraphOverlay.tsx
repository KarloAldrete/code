import type { Nest, PrDependencyView } from "@main/services/hedgemony/schemas";
import { useMemo } from "react";
import { useHogletPositionStore } from "../stores/hogletPositionStore";
import { selectNestHoglets, useHogletStore } from "../stores/hogletStore";
import { selectEdgesForNest, usePrGraphStore } from "../stores/prGraphStore";
import { broodHogletPosition } from "../utils/hogletPositions";

/**
 * Renders the PR dependency arrows for a single nest. Lives inside the same
 * world-space `motion.div` as the nest sprites; positioned absolutely so
 * arrow coordinates match nest/hoglet coordinates directly. Sits BELOW the
 * sprite layer so it doesn't obscure hoglet identity.
 *
 * Edge color/dash by state:
 * - pending: amber, dashed
 * - satisfied: green, solid
 * - broken: red, solid, slightly thicker
 * - follow_up: purple, dashed (Slice 7 follow-ups for visual continuity)
 */
export function NestPrGraphOverlay({ nest }: { nest: Nest }) {
  const edges = usePrGraphStore(selectEdgesForNest(nest.id));
  const hoglets = useHogletStore(selectNestHoglets(nest.id));
  const positionOverrides = useHogletPositionStore((s) => s.positions);

  // Stable ordering matches NestBroodCluster's `[...hoglets].sort(byCreatedAt)`
  // so brood-position indices line up.
  const orderedHoglets = useMemo(
    () =>
      [...hoglets].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [hoglets],
  );

  const positionByTaskId = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    orderedHoglets.forEach((hoglet, index) => {
      const override = positionOverrides[hoglet.id];
      const fallback = broodHogletPosition(index, orderedHoglets.length, {
        x: nest.mapX,
        y: nest.mapY,
      });
      map.set(hoglet.taskId, override ?? fallback);
    });
    return map;
  }, [orderedHoglets, positionOverrides, nest.mapX, nest.mapY]);

  const resolvedEdges = useMemo(
    () =>
      edges
        .map((edge) => {
          const parent = positionByTaskId.get(edge.parentTaskId);
          const child = positionByTaskId.get(edge.childTaskId);
          if (!parent || !child) return null;
          return { edge, parent, child };
        })
        .filter(
          (
            v,
          ): v is {
            edge: PrDependencyView;
            parent: { x: number; y: number };
            child: { x: number; y: number };
          } => v !== null,
        ),
    [edges, positionByTaskId],
  );

  if (resolvedEdges.length === 0) return null;

  // SVG sits in world space anchored at the map center; same trick as
  // hoglet sprites which translate from `top: 50% / left: 50%`. We grow the
  // SVG to a generous square so lines drawn at world coordinates near the
  // nest are visible without clipping. Coordinates use SVG's native space
  // (origin at top-left of the viewBox), so we translate the SVG by
  // (-HALF, -HALF) and re-anchor each endpoint by adding HALF.
  const HALF = 4000;

  return (
    <div
      aria-hidden
      className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute top-1/2 left-1/2"
      style={{ width: HALF * 2, height: HALF * 2 }}
    >
      <svg
        role="img"
        aria-label="PR dependency graph"
        width={HALF * 2}
        height={HALF * 2}
        viewBox={`0 0 ${HALF * 2} ${HALF * 2}`}
        fill="none"
      >
        <defs>
          <marker
            id="hedgemony-pr-arrow-pending"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="var(--amber-9)" />
          </marker>
          <marker
            id="hedgemony-pr-arrow-satisfied"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="var(--green-9)" />
          </marker>
          <marker
            id="hedgemony-pr-arrow-broken"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="var(--red-9)" />
          </marker>
          <marker
            id="hedgemony-pr-arrow-follow_up"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0 0 L10 5 L0 10 z" fill="var(--purple-9)" />
          </marker>
        </defs>
        {resolvedEdges.map(({ edge, parent, child }) => {
          const stroke = EDGE_STROKE[edge.state];
          const dash = EDGE_DASH[edge.state];
          const width = edge.state === "broken" ? 2.5 : 1.75;
          return (
            <line
              key={edge.id}
              x1={parent.x + HALF}
              y1={parent.y + HALF}
              x2={child.x + HALF}
              y2={child.y + HALF}
              stroke={stroke}
              strokeWidth={width}
              strokeDasharray={dash}
              markerEnd={`url(#hedgemony-pr-arrow-${edge.state})`}
              opacity={0.85}
            />
          );
        })}
      </svg>
    </div>
  );
}

const EDGE_STROKE: Record<PrDependencyView["state"], string> = {
  pending: "var(--amber-9)",
  satisfied: "var(--green-9)",
  broken: "var(--red-9)",
  follow_up: "var(--purple-9)",
};

const EDGE_DASH: Record<PrDependencyView["state"], string> = {
  pending: "6 4",
  satisfied: "0",
  broken: "0",
  follow_up: "4 4",
};
