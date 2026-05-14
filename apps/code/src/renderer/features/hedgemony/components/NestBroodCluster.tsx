import type { Hoglet, Nest } from "@main/services/hedgemony/schemas";
import { useEffect, useMemo } from "react";
import { initializeNestHogletStore } from "../service/hogletSubscriptionService";
import { useHogletPositionStore } from "../stores/hogletPositionStore";
import { selectNestHoglets, useHogletStore } from "../stores/hogletStore";
import { BroodHoglet } from "./BroodHoglet";

const RADIUS = 92;

interface NestBroodClusterProps {
  nest: Nest;
  selectedHogletId: string | null;
  onHogletSelect: (hogletId: string) => void;
}

function broodPosition(
  index: number,
  total: number,
  origin: { x: number; y: number },
): { x: number; y: number } {
  // Even angular distribution starting at -π/2 so the first sibling sits
  // directly above the nest. Stable as long as the caller sorts hoglets
  // deterministically.
  const safeTotal = Math.max(total, 1);
  const angle = -Math.PI / 2 + (2 * Math.PI * index) / safeTotal;
  return {
    x: origin.x + Math.cos(angle) * RADIUS,
    y: origin.y + Math.sin(angle) * RADIUS,
  };
}

export function NestBroodCluster({
  nest,
  selectedHogletId,
  onHogletSelect,
}: NestBroodClusterProps) {
  const hoglets = useHogletStore(selectNestHoglets(nest.id));
  const positionOverrides = useHogletPositionStore((s) => s.positions);

  useEffect(() => {
    return initializeNestHogletStore(nest.id);
  }, [nest.id]);

  const ordered = useMemo<Hoglet[]>(
    () =>
      [...hoglets].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
    [hoglets],
  );

  if (ordered.length === 0) return null;

  return (
    <>
      {ordered.map((hoglet, index) => {
        const override = positionOverrides[hoglet.id];
        const position =
          override ??
          broodPosition(index, ordered.length, {
            x: nest.mapX,
            y: nest.mapY,
          });
        return (
          <BroodHoglet
            key={hoglet.id}
            hoglet={hoglet}
            nestId={nest.id}
            index={index}
            x={position.x}
            y={position.y}
            selected={selectedHogletId === hoglet.id}
            onSelect={onHogletSelect}
          />
        );
      })}
    </>
  );
}
