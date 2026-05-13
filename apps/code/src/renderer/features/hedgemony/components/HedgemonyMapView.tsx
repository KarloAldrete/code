import type { Nest } from "@main/services/hedgemony/schemas";
import { trpcClient } from "@renderer/trpc/client";
import { logger } from "@utils/logger";
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

const log = logger.scope("hedgemony-map-view");

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

  const handleNestMove = async (nest: Nest, mapX: number, mapY: number) => {
    const previous = nest;
    useNestStore.getState().upsert({ ...nest, mapX, mapY });
    try {
      const updated = await trpcClient.hedgemony.nests.update.mutate({
        id: nest.id,
        mapX,
        mapY,
      });
      useNestStore.getState().upsert(updated);
    } catch (error) {
      log.error("Failed to move nest", { id: nest.id, error });
      useNestStore.getState().upsert(previous);
    }
  };

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
        onNestMove={handleNestMove}
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
