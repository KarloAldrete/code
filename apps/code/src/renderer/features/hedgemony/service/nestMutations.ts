import type { Nest } from "@main/services/hedgemony/schemas";
import { trpcClient } from "@renderer/trpc/client";
import { logger } from "@utils/logger";
import { toast } from "sonner";
import { playSfx } from "../audio/sfx";
import { useNestStore } from "../stores/nestStore";

const log = logger.scope("nest-mutations");

export interface MoveNestOptions {
  /**
   * When true, surfaces an undo toast that re-runs moveNest to put the nest
   * back where it was. The undo path itself is not undoable, so a chain of
   * undos collapses to a single hop.
   */
  undoable?: boolean;
  /**
   * Optional callback to flash a visual ping at the destination. Used by the
   * view to highlight where the nest just landed (and where it would land on
   * undo).
   */
  flashMoveMarker?: (mapX: number, mapY: number) => void;
}

/**
 * Optimistic move of a nest to (mapX, mapY). Rolls back local state and shows
 * an error toast if the RPC fails. With `undoable: true`, surfaces an undo
 * toast that snaps the nest back to its previous position.
 */
export async function moveNest(
  nest: Nest,
  mapX: number,
  mapY: number,
  options: MoveNestOptions = {},
): Promise<void> {
  const previous = nest;
  useNestStore.getState().upsert({ ...nest, mapX, mapY });
  try {
    const updated = await trpcClient.hedgemony.nests.update.mutate({
      id: nest.id,
      mapX,
      mapY,
    });
    useNestStore.getState().upsert(updated);
    if (options.undoable) {
      toast("Nest moved", {
        action: {
          label: "Undo",
          onClick: () => {
            options.flashMoveMarker?.(previous.mapX, previous.mapY);
            void moveNest(updated, previous.mapX, previous.mapY, {
              flashMoveMarker: options.flashMoveMarker,
            });
          },
        },
      });
    }
  } catch (error) {
    log.error("Failed to move nest", { id: nest.id, error });
    useNestStore.getState().upsert(previous);
    toast.error("Could not move nest");
    playSfx("error");
  }
}
