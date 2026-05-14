import type { HedgehogToolName } from "../hedgehog-tools";
import { killHogletHandler } from "./kill-hoglet-handler";
import { linkPrDependencyHandler } from "./link-pr-dependency-handler";
import { messageHogletHandler } from "./message-hoglet-handler";
import { raiseHogletHandler } from "./raise-hoglet-handler";
import { rebaseChildHandler } from "./rebase-child-handler";
import { spawnHogletHandler } from "./spawn-hoglet-handler";
import type { HedgehogToolHandler } from "./types";
import { unlinkPrDependencyHandler } from "./unlink-pr-dependency-handler";
import { writeAuditEntryHandler } from "./write-audit-entry-handler";

const handlerList: readonly HedgehogToolHandler[] = [
  spawnHogletHandler,
  raiseHogletHandler,
  killHogletHandler,
  messageHogletHandler,
  writeAuditEntryHandler,
  linkPrDependencyHandler,
  unlinkPrDependencyHandler,
  rebaseChildHandler,
];

export const HEDGEHOG_HANDLERS: ReadonlyMap<
  HedgehogToolName,
  HedgehogToolHandler
> = new Map(handlerList.map((h) => [h.name, h]));
