import { and, eq, isNull, or } from "drizzle-orm";
import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { hedgemonyOverlap } from "../schema";
import type { DatabaseService } from "../service";

export type Overlap = typeof hedgemonyOverlap.$inferSelect;
export type NewOverlap = typeof hedgemonyOverlap.$inferInsert;

export type OverlapKind =
  | "goal_embedding"
  | "pr_graph"
  | "signal_runnerup"
  | "scratchpad"
  | "chat_xref";

export interface UpsertOverlapData {
  nestAId: string;
  nestBId: string;
  kind: OverlapKind;
  score: number;
  evidenceJson: string;
}

@injectable()
export class OverlapRepository {
  constructor(
    @inject(MAIN_TOKENS.DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  findOpenForPair(
    nestAId: string,
    nestBId: string,
    kind: OverlapKind,
  ): Overlap | null {
    return (
      this.db
        .select()
        .from(hedgemonyOverlap)
        .where(
          and(
            or(
              and(
                eq(hedgemonyOverlap.nestAId, nestAId),
                eq(hedgemonyOverlap.nestBId, nestBId),
              ),
              and(
                eq(hedgemonyOverlap.nestAId, nestBId),
                eq(hedgemonyOverlap.nestBId, nestAId),
              ),
            ),
            eq(hedgemonyOverlap.kind, kind),
            isNull(hedgemonyOverlap.resolvedAt),
          ),
        )
        .get() ?? null
    );
  }

  /**
   * Upsert by (pair, kind). Re-inserts a fresh open row when none exists,
   * otherwise bumps `lastSeenAt`, `score`, `evidenceJson`. Pair direction is
   * normalized so `(A,B)` and `(B,A)` are the same row.
   */
  upsertOpen(data: UpsertOverlapData): Overlap {
    const [a, b] =
      data.nestAId < data.nestBId
        ? [data.nestAId, data.nestBId]
        : [data.nestBId, data.nestAId];
    const existing = this.findOpenForPair(a, b, data.kind);
    const timestamp = new Date().toISOString();
    if (existing) {
      this.db
        .update(hedgemonyOverlap)
        .set({
          score: data.score,
          evidenceJson: data.evidenceJson,
          lastSeenAt: timestamp,
        })
        .where(eq(hedgemonyOverlap.id, existing.id))
        .run();
      const after = this.db
        .select()
        .from(hedgemonyOverlap)
        .where(eq(hedgemonyOverlap.id, existing.id))
        .get();
      if (!after) {
        throw new Error(`Failed to update overlap ${existing.id}`);
      }
      return after;
    }
    const id = crypto.randomUUID();
    const row: NewOverlap = {
      id,
      nestAId: a,
      nestBId: b,
      kind: data.kind,
      score: data.score,
      evidenceJson: data.evidenceJson,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      resolvedAt: null,
    };
    this.db.insert(hedgemonyOverlap).values(row).run();
    const created = this.db
      .select()
      .from(hedgemonyOverlap)
      .where(eq(hedgemonyOverlap.id, id))
      .get();
    if (!created) {
      throw new Error(`Failed to create overlap ${id}`);
    }
    return created;
  }

  listOpen(): Overlap[] {
    return this.db
      .select()
      .from(hedgemonyOverlap)
      .where(isNull(hedgemonyOverlap.resolvedAt))
      .all();
  }

  listAll(): Overlap[] {
    return this.db.select().from(hedgemonyOverlap).all();
  }

  resolve(id: string): void {
    this.db
      .update(hedgemonyOverlap)
      .set({ resolvedAt: new Date().toISOString() })
      .where(eq(hedgemonyOverlap.id, id))
      .run();
  }

  /**
   * Resolve every open overlap row whose `lastSeenAt` is older than the given
   * cutoff. Used by the BuilderTickService to age out overlaps that stopped
   * being observed.
   */
  resolveStaleBefore(cutoffIso: string): number {
    const stale = this.db
      .select()
      .from(hedgemonyOverlap)
      .where(isNull(hedgemonyOverlap.resolvedAt))
      .all()
      .filter((row) => row.lastSeenAt < cutoffIso);
    for (const row of stale) {
      this.resolve(row.id);
    }
    return stale.length;
  }
}
