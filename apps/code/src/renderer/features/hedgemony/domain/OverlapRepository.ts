import type { Overlap } from "@main/services/hedgemony/schemas";

export type OverlapKeysListener = (added: string[], removed: string[]) => void;

/**
 * Narrow interface over overlap state used by federation UI components.
 * Overlaps are observation rows the Builder writes — they decay if not
 * re-observed, and resolve when a proposal is acted on. The renderer caches
 * the open set and renders faint arcs between nest pairs.
 */
export interface OverlapRepository {
  upsert(overlap: Overlap): void;
  resolve(id: string): void;
  setAll(overlaps: Overlap[]): void;
  list(): Overlap[];
  listForPair(nestAId: string, nestBId: string): Overlap[];
  subscribeToKeys(listener: OverlapKeysListener): () => void;
}
