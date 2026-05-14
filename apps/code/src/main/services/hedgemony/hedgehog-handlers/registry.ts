import type { HedgehogToolName } from "../hedgehog-tools";
import { killHogletHandler } from "./kill-hoglet-handler";
import { messageHogletHandler } from "./message-hoglet-handler";
import { raiseHogletHandler } from "./raise-hoglet-handler";
import type { HedgehogToolHandler } from "./types";
import { writeAuditEntryHandler } from "./write-audit-entry-handler";

const handlerList: readonly HedgehogToolHandler[] = [
  raiseHogletHandler,
  killHogletHandler,
  messageHogletHandler,
  writeAuditEntryHandler,
];

export const HEDGEHOG_HANDLERS: ReadonlyMap<
  HedgehogToolName,
  HedgehogToolHandler
> = new Map(handlerList.map((h) => [h.name, h]));
