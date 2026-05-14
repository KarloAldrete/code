import { PointerSensor } from "@dnd-kit/dom";
import type { DragDropEvents } from "@dnd-kit/react";
import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { Box, Flex, Text } from "@radix-ui/themes";
import type {
  NewTileInput,
  ProjectIconId,
  ProjectMember,
  Tile,
  TileSize,
} from "@shared/types/work-projects";
import { type ReactNode, useCallback } from "react";
import { AddTileMenu } from "./AddTileMenu";
import { SIZE_TO_COLSPAN } from "./TileFrame";
import { TileRenderer } from "./TileRenderer";

interface ProjectCanvasProps {
  projectId: string;
  tiles: Tile[];
  members: ProjectMember[];
  onAddTile: (tile: NewTileInput) => Promise<void>;
  onRemoveTile: (tileId: string) => Promise<void>;
  onResizeTile: (tileId: string, size: TileSize) => Promise<void>;
  onMoveTile: (tileId: string, toIndex: number) => Promise<void>;
  onApplyPending: (tileId: string) => Promise<void>;
  onRejectPending: (tileId: string) => Promise<void>;
  onUpdateTitleTile: (patch: {
    name?: string;
    tagline?: string;
    iconId?: ProjectIconId;
  }) => Promise<void>;
  onUpdateNoteTile: (tileId: string, body: string) => Promise<void>;
  onUpdateFileTile: (
    tileId: string,
    patch: { filename?: string; contents?: string },
  ) => Promise<void>;
}

function SortableTile({
  id,
  index,
  children,
}: {
  id: string;
  index: number;
  children: ReactNode;
}) {
  const { ref, isDragging } = useSortable({
    id,
    index,
    group: "project-canvas-tiles",
    transition: { duration: 200, easing: "ease" },
  });

  return (
    <Box
      ref={ref}
      className="min-w-0"
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? "grabbing" : undefined,
      }}
    >
      {children}
    </Box>
  );
}

export function ProjectCanvas({
  tiles,
  members,
  onAddTile,
  onRemoveTile,
  onResizeTile,
  onMoveTile,
  onApplyPending,
  onRejectPending,
  onUpdateTitleTile,
  onUpdateNoteTile,
  onUpdateFileTile,
}: ProjectCanvasProps) {
  const handleDragOver: DragDropEvents["dragover"] = useCallback(
    (event) => {
      const sourceId = event.operation.source?.id;
      const targetId = event.operation.target?.id;
      if (!sourceId || !targetId || sourceId === targetId) return;
      const sourceIndex = tiles.findIndex((t) => t.id === String(sourceId));
      const targetIndex = tiles.findIndex((t) => t.id === String(targetId));
      if (sourceIndex < 0 || targetIndex < 0) return;
      void onMoveTile(String(sourceId), targetIndex);
    },
    [tiles, onMoveTile],
  );

  return (
    <Box className="scrollbar-overlay-y h-full w-full overflow-y-auto">
      <Flex
        direction="column"
        gap="4"
        className="mx-auto w-full max-w-[1000px] px-6 pt-8 pb-12"
      >
        <Flex align="center" justify="end" className="-mb-1">
          <AddTileMenu
            onAdd={(tile) => {
              void onAddTile(tile);
            }}
          />
        </Flex>
        {tiles.length === 0 ? (
          <EmptyState />
        ) : (
          <DragDropProvider
            onDragOver={handleDragOver}
            sensors={[
              {
                plugin: PointerSensor,
                options: {
                  activationConstraints: { distance: { value: 6 } },
                },
              },
            ]}
          >
            <Box className="grid auto-rows-min grid-cols-12 gap-3">
              {tiles.map((tile, index) => (
                <Box
                  key={tile.id}
                  className={`${SIZE_TO_COLSPAN[tile.size]} min-w-0`}
                >
                  <SortableTile id={tile.id} index={index}>
                    <TileRenderer
                      tile={tile}
                      members={members}
                      onRemove={
                        tile.type === "title"
                          ? undefined
                          : () => {
                              void onRemoveTile(tile.id);
                            }
                      }
                      onResize={
                        tile.type === "title"
                          ? undefined
                          : (size) => {
                              void onResizeTile(tile.id, size);
                            }
                      }
                      onApplyPending={
                        tile.state !== "live"
                          ? () => {
                              void onApplyPending(tile.id);
                            }
                          : undefined
                      }
                      onRejectPending={
                        tile.state !== "live"
                          ? () => {
                              void onRejectPending(tile.id);
                            }
                          : undefined
                      }
                      onUpdateTitleTile={(patch) => {
                        void onUpdateTitleTile(patch);
                      }}
                      onUpdateNoteTile={(body) => {
                        void onUpdateNoteTile(tile.id, body);
                      }}
                      onUpdateFileTile={(patch) => {
                        void onUpdateFileTile(tile.id, patch);
                      }}
                    />
                  </SortableTile>
                </Box>
              ))}
            </Box>
          </DragDropProvider>
        )}
      </Flex>
    </Box>
  );
}

function EmptyState() {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="2"
      className="rounded-(--radius-3) border border-(--gray-5) border-dashed bg-(--gray-1) px-6 py-12"
    >
      <Text as="div" weight="medium" className="text-(--gray-12) text-[14px]">
        Nothing on this canvas yet
      </Text>
      <Text
        as="div"
        className="max-w-[420px] text-center text-(--gray-11) text-[12px]"
      >
        Add a tile from the menu, or ask the chat on the right to set this
        project up — it can propose tiles you accept or reject.
      </Text>
    </Flex>
  );
}
