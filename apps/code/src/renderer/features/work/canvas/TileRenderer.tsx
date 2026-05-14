import type {
  ProjectIconId,
  ProjectMember,
  Tile,
  TileSize,
} from "@shared/types/work-projects";
import { FileTile } from "./tiles/FileTile";
import { HeadlineTile } from "./tiles/HeadlineTile";
import { InsightTile } from "./tiles/InsightTile";
import { NoteTile } from "./tiles/NoteTile";
import { SkillOutputTile } from "./tiles/SkillOutputTile";
import { TitleTile } from "./tiles/TitleTile";

interface TileRendererProps {
  tile: Tile;
  members: ProjectMember[];
  onRemove?: () => void;
  onResize?: (size: TileSize) => void;
  onApplyPending?: () => void;
  onRejectPending?: () => void;
  onUpdateTitleTile?: (patch: {
    name?: string;
    tagline?: string;
    iconId?: ProjectIconId;
  }) => void;
  onUpdateNoteTile?: (patch: {
    body?: string;
    tone?: "yellow" | "blue" | "green" | "pink" | "neutral";
  }) => void;
  onUpdateFileTile?: (patch: { filename?: string; contents?: string }) => void;
}

export function TileRenderer({
  tile,
  members,
  onRemove,
  onResize,
  onApplyPending,
  onRejectPending,
  onUpdateTitleTile,
  onUpdateNoteTile,
  onUpdateFileTile,
}: TileRendererProps) {
  switch (tile.type) {
    case "title":
      return (
        <TitleTile
          tile={tile}
          members={members}
          onApplyPending={onApplyPending}
          onRejectPending={onRejectPending}
          onUpdate={onUpdateTitleTile}
        />
      );
    case "headline":
      return (
        <HeadlineTile
          tile={tile}
          onRemove={onRemove}
          onResize={onResize}
          onApplyPending={onApplyPending}
          onRejectPending={onRejectPending}
        />
      );
    case "insight":
      return (
        <InsightTile
          tile={tile}
          onRemove={onRemove}
          onResize={onResize}
          onApplyPending={onApplyPending}
          onRejectPending={onRejectPending}
        />
      );
    case "file":
      return (
        <FileTile
          tile={tile}
          onRemove={onRemove}
          onResize={onResize}
          onApplyPending={onApplyPending}
          onRejectPending={onRejectPending}
          onUpdate={onUpdateFileTile}
        />
      );
    case "skill_output":
      return (
        <SkillOutputTile
          tile={tile}
          onRemove={onRemove}
          onResize={onResize}
          onApplyPending={onApplyPending}
          onRejectPending={onRejectPending}
        />
      );
    case "note":
      return (
        <NoteTile
          tile={tile}
          onRemove={onRemove}
          onResize={onResize}
          onApplyPending={onApplyPending}
          onRejectPending={onRejectPending}
          onUpdate={onUpdateNoteTile}
        />
      );
  }
}
