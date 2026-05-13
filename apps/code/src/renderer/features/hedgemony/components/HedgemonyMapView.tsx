import { useEffect, useState } from "react";
import {
  initializeNestStore,
  selectNests,
  useNestStore,
} from "../stores/nestStore";
import { HedgemonyEmptyState } from "./HedgemonyEmptyState";
import { HedgemonyMapSurface } from "./HedgemonyMapSurface";
import { PlaceNestDialog } from "./PlaceNestDialog";

export function HedgemonyMapView() {
  const nests = useNestStore(selectNests);
  const loaded = useNestStore((s) => s.loaded);

  const [pendingPlacement, setPendingPlacement] = useState<{
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    return initializeNestStore();
  }, []);

  const showEmptyState = loaded && nests.length === 0;

  return (
    <>
      <HedgemonyMapSurface
        nests={nests}
        overlay={showEmptyState ? <HedgemonyEmptyState /> : null}
        onMapClick={(x, y) => setPendingPlacement({ x, y })}
      />
      <PlaceNestDialog
        open={pendingPlacement !== null}
        mapX={pendingPlacement?.x ?? 0}
        mapY={pendingPlacement?.y ?? 0}
        onClose={() => setPendingPlacement(null)}
      />
    </>
  );
}
