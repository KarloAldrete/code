import { useEffect, useState } from "react";
import {
  initializeNestStore,
  selectNests,
  useNestStore,
} from "../stores/nestStore";
import { HedgemonyEmptyState } from "./HedgemonyEmptyState";
import { HedgemonyMapSurface } from "./HedgemonyMapSurface";
import { NestDetailPanel } from "./NestDetailPanel";
import { PlaceNestDialog } from "./PlaceNestDialog";

export function HedgemonyMapView() {
  const nests = useNestStore(selectNests);
  const loaded = useNestStore((s) => s.loaded);

  const [pendingPlacement, setPendingPlacement] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [activeNestId, setActiveNestId] = useState<string | null>(null);

  useEffect(() => {
    return initializeNestStore();
  }, []);

  const showEmptyState = loaded && nests.length === 0;
  const activeNest = activeNestId
    ? (nests.find((nest) => nest.id === activeNestId) ?? null)
    : null;

  return (
    <>
      <HedgemonyMapSurface
        nests={nests}
        overlay={showEmptyState ? <HedgemonyEmptyState /> : null}
        onMapClick={(x, y) => {
          setActiveNestId(null);
          setPendingPlacement({ x, y });
        }}
        onNestClick={(nest) => setActiveNestId(nest.id)}
      />
      {activeNest && (
        <NestDetailPanel
          nest={activeNest}
          onClose={() => setActiveNestId(null)}
        />
      )}
      <PlaceNestDialog
        open={pendingPlacement !== null}
        mapX={pendingPlacement?.x ?? 0}
        mapY={pendingPlacement?.y ?? 0}
        onClose={() => setPendingPlacement(null)}
      />
    </>
  );
}
