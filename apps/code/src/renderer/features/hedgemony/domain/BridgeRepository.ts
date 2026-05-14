import type {
  Bridge,
  CreateBridgeInput,
  ListBridgesInput,
} from "@main/services/hedgemony/schemas";

export type BridgeKeysListener = (added: string[], removed: string[]) => void;

/**
 * Narrow interface over bridge state. Bridges are durable cross-nest context
 * links (signal forwards, scratchpad refs, PR dep edges crossing nests,
 * shared docs). They are lighter-weight than merges and reversible.
 */
export interface BridgeRepository {
  upsert(bridge: Bridge): void;
  remove(id: string): void;
  setAll(bridges: Bridge[]): void;
  list(): Bridge[];
  listForNest(nestId: string): Bridge[];
  subscribeToKeys(listener: BridgeKeysListener): () => void;
}

/**
 * Remote handle for bridge mutations the renderer never owns — bridges are
 * created via the federation tRPC router. Kept symmetric to other
 * `*RemoteService` interfaces in this directory.
 */
export interface BridgeRemoteService {
  list(input?: ListBridgesInput): Promise<Bridge[]>;
  create(input: CreateBridgeInput): Promise<Bridge>;
  remove(input: { id: string }): Promise<void>;
}
