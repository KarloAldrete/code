import type {
  Overlap,
  OverlapWatchEvent,
} from "@main/services/hedgemony/schemas";
import type { WatchCallbacks, WatchHandle } from "./NestRemoteService";

/**
 * Narrow interface over the remote overlap API. Overlaps are observed by the
 * Builder and consumed by the renderer through `list` + a `watch` subscription
 * keyed off `HedgemonyEvent.OverlapChanged`.
 */
export interface OverlapRemoteService {
  list(): Promise<Overlap[]>;
  watch(callbacks: WatchCallbacks<OverlapWatchEvent>): WatchHandle;
}
