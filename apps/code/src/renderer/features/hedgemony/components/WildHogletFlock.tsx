import { useMemo } from "react";
import { useHogletPositionStore } from "../stores/hogletPositionStore";
import { selectWildHoglets, useHogletStore } from "../stores/hogletStore";
import { wildHogletPosition } from "../utils/hogletPositions";
import { WildHoglet } from "./WildHoglet";

/**
 * Wild hoglets live in the WILD_BUCKET with no nest. We give each one a
 * deterministic world position derived from its id, placed in a small ring
 * just outside the hedgehouse footprint so they read as having walked out of
 * the town hall (the hedgehouse sits at the map origin).
 *
 * Subscription to the wild bucket is owned by HedgemonyHoldingPanel (which
 * always mounts) — we just read from the store here.
 */

interface WildHogletFlockProps {
  selectedHogletIds: ReadonlySet<string>;
  onHogletSelect: (hogletId: string, additive: boolean) => void;
}

export function WildHogletFlock({
  selectedHogletIds,
  onHogletSelect,
}: WildHogletFlockProps) {
  const hoglets = useHogletStore(selectWildHoglets);
  const positionOverrides = useHogletPositionStore((s) => s.positions);

  const ordered = useMemo(
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
        const { x, y } = override ?? wildHogletPosition(hoglet.id);
        return (
          <WildHoglet
            key={hoglet.id}
            hoglet={hoglet}
            index={index}
            x={x}
            y={y}
            selected={selectedHogletIds.has(hoglet.id)}
            onSelect={onHogletSelect}
          />
        );
      })}
    </>
  );
}
