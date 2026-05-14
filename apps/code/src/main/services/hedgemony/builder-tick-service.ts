import { inject, injectable } from "inversify";
import type { BuilderStateRepository } from "../../db/repositories/builder-state-repository";
import type { NestMessageRepository } from "../../db/repositories/nest-message-repository";
import type {
  Nest,
  NestRepository,
} from "../../db/repositories/nest-repository";
import type {
  Overlap,
  OverlapRepository,
} from "../../db/repositories/overlap-repository";
import type { PrDependencyRepository } from "../../db/repositories/pr-dependency-repository";
import type {
  Proposal,
  ProposalRepository,
} from "../../db/repositories/proposal-repository";
import { MAIN_TOKENS } from "../../di/tokens";
import { logger } from "../../utils/logger";
import { TypedEventEmitter } from "../../utils/typed-event-emitter";
import {
  HedgemonyEvent,
  type HedgemonyEvents,
  type OverlapKind,
} from "./schemas";
import { stringifyError } from "./utils";

const log = logger.scope("builder-tick-service");

const DEFAULT_BUILDER_TICK_MS = 60_000;
const DEFAULT_OVERLAP_EMBEDDING_THRESHOLD = 0.78;
const DEFAULT_MERGE_PROPOSE_AFTER_TICKS = 5;
const DEFAULT_OVERLAP_DECAY_MS = 24 * 60 * 60 * 1000;

export interface BuilderTickConfig {
  builderTickMs: number;
  overlapEmbeddingThreshold: number;
  mergeProposeAfterTicks: number;
  autoExecuteThreshold: number;
  autoExecuteEnabled: boolean;
  overlapDecayMs: number;
}

const DEFAULT_CONFIG: BuilderTickConfig = {
  builderTickMs: DEFAULT_BUILDER_TICK_MS,
  overlapEmbeddingThreshold: DEFAULT_OVERLAP_EMBEDDING_THRESHOLD,
  mergeProposeAfterTicks: DEFAULT_MERGE_PROPOSE_AFTER_TICKS,
  autoExecuteThreshold: 0.95,
  autoExecuteEnabled: false,
  overlapDecayMs: DEFAULT_OVERLAP_DECAY_MS,
};

/**
 * Slice 9 of Hedgemony — the Builder. An across-nests, slow-cadence tick that
 * computes overlap observations between active nests and writes proposals
 * (merge / split / bridge / forward / adopt) when overlaps sustain above
 * threshold for `mergeProposeAfterTicks`. The Builder never executes
 * destructive structural changes herself — those go through FederationService
 * after the operator accepts a proposal.
 *
 * NOT a Task. Mirrors `HedgehogTickService` lifecycle. Inert when fewer than
 * two active nests exist.
 */
@injectable()
export class BuilderTickService extends TypedEventEmitter<HedgemonyEvents> {
  private started = false;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private config: BuilderTickConfig = DEFAULT_CONFIG;
  // Tracks how many consecutive ticks each `(pair, kind)` overlap has been
  // observed. Reset when the overlap is missed (kept simple — the row's
  // `lastSeenAt` is the authoritative state, this is just for proposal cadence).
  private readonly streakCounts = new Map<string, number>();

  constructor(
    @inject(MAIN_TOKENS.NestRepository)
    private readonly nests: NestRepository,
    @inject(MAIN_TOKENS.NestMessageRepository)
    private readonly nestMessages: NestMessageRepository,
    @inject(MAIN_TOKENS.PrDependencyRepository)
    private readonly prDependencies: PrDependencyRepository,
    @inject(MAIN_TOKENS.OverlapRepository)
    private readonly overlaps: OverlapRepository,
    @inject(MAIN_TOKENS.ProposalRepository)
    private readonly proposals: ProposalRepository,
    @inject(MAIN_TOKENS.BuilderStateRepository)
    private readonly builderState: BuilderStateRepository,
  ) {
    super();
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    this.config = this.loadConfig();
    this.tickHandle = setInterval(() => {
      this.tick().catch((error) =>
        log.error("builder tick failed", { error: stringifyError(error) }),
      );
    }, this.config.builderTickMs);
    log.info("BuilderTickService started", {
      tickMs: this.config.builderTickMs,
    });
  }

  stop(): void {
    if (!this.started) return;
    this.started = false;
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
    log.info("BuilderTickService stopped");
  }

  getConfig(): BuilderTickConfig {
    return this.config;
  }

  setConfig(config: Partial<BuilderTickConfig>): BuilderTickConfig {
    this.config = { ...this.config, ...config };
    this.builderState.upsert({ configJson: JSON.stringify(this.config) });
    return this.config;
  }

  /**
   * Public for tests. Production callers go through the timer started by
   * `start()`. Each tick: load active nests, compute overlaps for every kind
   * we support without embeddings, upsert overlap rows with decay, then write
   * proposals where streaks pass `mergeProposeAfterTicks`.
   */
  async tick(): Promise<void> {
    const active = this.nests
      .findAll()
      .filter(
        (n) =>
          n.status === "active" &&
          (n.mergedIntoId === null || n.mergedIntoId === undefined),
      );

    if (active.length < 2) {
      this.recordTickComplete();
      return;
    }

    this.decayStaleOverlaps();

    const observed = new Set<string>();

    // TODO(federation): embedding-based overlap detection
    // Wire in HogQL `embedText` over each nest's goalPrompt + grouped signals
    // and write `goal_embedding` overlaps when cosine similarity rises above
    // `config.overlapEmbeddingThreshold`.

    for (const [a, b] of pairs(active)) {
      const prCrossings = this.detectPrGraphCrossings(a, b);
      for (const crossing of prCrossings) {
        const key = makeStreakKey(a.id, b.id, "pr_graph");
        observed.add(key);
        const row = this.overlaps.upsertOpen({
          nestAId: a.id,
          nestBId: b.id,
          kind: "pr_graph",
          score: crossing.score,
          evidenceJson: JSON.stringify(crossing.evidence),
        });
        this.bumpStreak(key);
        this.emitOverlap(row);
        this.maybeProposeMerge(a, b, row);
      }

      const chatXref = this.detectChatXref(a, b);
      if (chatXref) {
        const key = makeStreakKey(a.id, b.id, "chat_xref");
        observed.add(key);
        const row = this.overlaps.upsertOpen({
          nestAId: a.id,
          nestBId: b.id,
          kind: "chat_xref",
          score: chatXref.score,
          evidenceJson: JSON.stringify(chatXref.evidence),
        });
        this.bumpStreak(key);
        this.emitOverlap(row);
      }
    }

    for (const key of [...this.streakCounts.keys()]) {
      if (!observed.has(key)) this.streakCounts.delete(key);
    }

    this.recordTickComplete();
  }

  /**
   * The Builder's primary structural proposal kind. Merges require the PR
   * graph to cross AND the streak to be at least `mergeProposeAfterTicks`.
   * Dedupes against existing open merge proposals for the same pair.
   */
  private maybeProposeMerge(a: Nest, b: Nest, latest: Overlap): void {
    const key = makeStreakKey(a.id, b.id, "pr_graph");
    const streak = this.streakCounts.get(key) ?? 0;
    if (streak < this.config.mergeProposeAfterTicks) return;

    const existing = this.proposals.findOpenByKindAndPair("merge", a.id, b.id);
    if (existing) return;

    const evidence = {
      reason: "sustained_pr_graph_crossing",
      streakTicks: streak,
      latestOverlapId: latest.id,
      score: latest.score,
    };
    const proposal = this.proposals.insert({
      kind: "merge",
      primaryNestId: a.id,
      secondaryNestId: b.id,
      evidenceJson: JSON.stringify(evidence),
      status: "open",
    });
    this.emit(HedgemonyEvent.ProposalChanged, {
      kind: "upsert",
      proposal: proposal as Proposal,
    });
    log.info("Builder wrote merge proposal", {
      proposalId: proposal.id,
      a: a.id,
      b: b.id,
      streak,
    });
  }

  /**
   * Looks at every `(parent, child)` PR dependency edge in nest A and every
   * edge in nest B; a "crossing" is an edge that touches a task in the other
   * nest. Cheap because PR-graph edges are already nest-partitioned.
   */
  private detectPrGraphCrossings(
    a: Nest,
    b: Nest,
  ): Array<{ score: number; evidence: Record<string, unknown> }> {
    const edgesA = this.prDependencies.listForNest(a.id);
    const edgesB = this.prDependencies.listForNest(b.id);
    if (edgesA.length === 0 || edgesB.length === 0) return [];

    const taskIdsA = new Set<string>();
    for (const edge of edgesA) {
      taskIdsA.add(edge.parentTaskId);
      taskIdsA.add(edge.childTaskId);
    }
    const taskIdsB = new Set<string>();
    for (const edge of edgesB) {
      taskIdsB.add(edge.parentTaskId);
      taskIdsB.add(edge.childTaskId);
    }
    const shared: string[] = [];
    for (const t of taskIdsA) if (taskIdsB.has(t)) shared.push(t);
    if (shared.length === 0) return [];
    const score = Math.min(
      1,
      shared.length / Math.max(taskIdsA.size, taskIdsB.size),
    );
    return [
      {
        score,
        evidence: {
          sharedTaskIds: shared,
          countA: taskIdsA.size,
          countB: taskIdsB.size,
        },
      },
    ];
  }

  /**
   * Cheap regex pass over each nest's most recent audit/hedgehog messages —
   * if nest A's chat mentions nest B's name (or vice versa), record a
   * `chat_xref` overlap. Bounded to the most recent N messages per nest so
   * the tick stays fast.
   */
  private detectChatXref(
    a: Nest,
    b: Nest,
  ): { score: number; evidence: Record<string, unknown> } | null {
    const messagesA = this.nestMessages.listByNestId(a.id).slice(-50);
    const messagesB = this.nestMessages.listByNestId(b.id).slice(-50);
    const nameA = escapeRegExp(a.name);
    const nameB = escapeRegExp(b.name);
    const refA = new RegExp(`\\b${nameB}\\b`, "i");
    const refB = new RegExp(`\\b${nameA}\\b`, "i");
    const hitsAtoB = messagesA.filter((m) => refA.test(m.body)).length;
    const hitsBtoA = messagesB.filter((m) => refB.test(m.body)).length;
    const total = hitsAtoB + hitsBtoA;
    if (total === 0) return null;
    const score = Math.min(1, total / 5);
    return {
      score,
      evidence: { hitsAtoB, hitsBtoA },
    };
  }

  /**
   * Records a runner-up overlap from the affinity router for a new
   * SignalReport that scored above threshold for more than one nest. Called
   * directly from AffinityRouterService — federation does not poll signals.
   */
  recordSignalRunnerup(input: {
    primaryNestId: string;
    runnerUpNestId: string;
    signalReportId: string;
    primaryScore: number;
    runnerUpScore: number;
  }): void {
    const evidence = {
      signalReportId: input.signalReportId,
      primaryScore: input.primaryScore,
      runnerUpScore: input.runnerUpScore,
    };
    const row = this.overlaps.upsertOpen({
      nestAId: input.primaryNestId,
      nestBId: input.runnerUpNestId,
      kind: "signal_runnerup",
      score: input.runnerUpScore,
      evidenceJson: JSON.stringify(evidence),
    });
    this.emitOverlap(row);
  }

  private decayStaleOverlaps(): void {
    const cutoff = new Date(
      Date.now() - this.config.overlapDecayMs,
    ).toISOString();
    const resolved = this.overlaps.resolveStaleBefore(cutoff);
    if (resolved > 0) {
      log.debug("decayed stale overlaps", { count: resolved });
    }
  }

  private emitOverlap(row: Overlap): void {
    this.emit(HedgemonyEvent.OverlapChanged, {
      kind: "upsert",
      overlap: row,
    });
  }

  private recordTickComplete(): void {
    this.builderState.upsert({ lastTickAt: new Date().toISOString() });
  }

  private bumpStreak(key: string): void {
    this.streakCounts.set(key, (this.streakCounts.get(key) ?? 0) + 1);
  }

  private loadConfig(): BuilderTickConfig {
    const row = this.builderState.get();
    if (!row?.configJson) return DEFAULT_CONFIG;
    try {
      const parsed = JSON.parse(row.configJson) as Partial<BuilderTickConfig>;
      return { ...DEFAULT_CONFIG, ...parsed };
    } catch (error) {
      log.warn("builder config_json was malformed; falling back to defaults", {
        error: stringifyError(error),
      });
      return DEFAULT_CONFIG;
    }
  }
}

function* pairs<T>(items: T[]): IterableIterator<[T, T]> {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a !== undefined && b !== undefined) yield [a, b];
    }
  }
}

function makeStreakKey(a: string, b: string, kind: OverlapKind): string {
  const [x, y] = a < b ? [a, b] : [b, a];
  return `${x}::${y}::${kind}`;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
