import type {
  MergeNestsInput,
  Nest,
  SplitNestInput,
} from "@main/services/hedgemony/schemas";

export interface MergeNestsResult {
  primary: Nest;
  secondary: Nest;
  movedHogletCount: number;
}

export interface SplitNestResult {
  source: Nest;
  spawned: Nest;
  movedHogletCount: number;
}

/**
 * Remote handle for the destructive nest operations exposed by the federation
 * router (`nests.merge`, `nests.split`). Per spec, both are operator-confirmed
 * only and run as sagas on the main process.
 */
export interface FederationNestRemoteService {
  merge(input: MergeNestsInput): Promise<MergeNestsResult>;
  split(input: SplitNestInput): Promise<SplitNestResult>;
}
