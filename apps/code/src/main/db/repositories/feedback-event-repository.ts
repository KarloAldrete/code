import { and, desc, eq } from "drizzle-orm";
import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { hedgemonyFeedbackEvents } from "../schema";
import type { DatabaseService } from "../service";

export type FeedbackEvent = typeof hedgemonyFeedbackEvents.$inferSelect;
export type NewFeedbackEvent = typeof hedgemonyFeedbackEvents.$inferInsert;

export type FeedbackEventSource = "pr_review" | "ci" | "issue" | "hedgehog";
export type FeedbackEventOutcome = "injected" | "follow_up_spawned" | "failed";
export type FeedbackTrustTier = "operator" | "internal" | "external";

export interface InsertFeedbackEventData {
  nestId: string | null;
  hogletTaskId: string;
  source: FeedbackEventSource;
  payloadHash: string;
  payloadRef: string;
  trustTier?: FeedbackTrustTier;
  routedOutcome: FeedbackEventOutcome;
}

export interface DedupeKey {
  hogletTaskId: string;
  source: FeedbackEventSource;
  payloadHash: string;
}

const byDedupeKey = (key: DedupeKey) =>
  and(
    eq(hedgemonyFeedbackEvents.hogletTaskId, key.hogletTaskId),
    eq(hedgemonyFeedbackEvents.source, key.source),
    eq(hedgemonyFeedbackEvents.payloadHash, key.payloadHash),
  );

@injectable()
export class FeedbackEventRepository {
  constructor(
    @inject(MAIN_TOKENS.DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  findByDedupeKey(key: DedupeKey): FeedbackEvent | null {
    return (
      this.db
        .select()
        .from(hedgemonyFeedbackEvents)
        .where(byDedupeKey(key))
        .get() ?? null
    );
  }

  insertIgnoreOnDuplicate(data: InsertFeedbackEventData): {
    inserted: boolean;
    row: FeedbackEvent;
  } {
    const id = crypto.randomUUID();
    const injectedAt = new Date().toISOString();
    const row: NewFeedbackEvent = {
      id,
      nestId: data.nestId,
      hogletTaskId: data.hogletTaskId,
      source: data.source,
      payloadHash: data.payloadHash,
      payloadRef: data.payloadRef,
      trustTier: data.trustTier ?? "external",
      routedOutcome: data.routedOutcome,
      injectedAt,
    };
    const returned = this.db
      .insert(hedgemonyFeedbackEvents)
      .values(row)
      .onConflictDoNothing({
        target: [
          hedgemonyFeedbackEvents.hogletTaskId,
          hedgemonyFeedbackEvents.source,
          hedgemonyFeedbackEvents.payloadHash,
        ],
      })
      .returning()
      .all();
    if (returned.length > 0) {
      return { inserted: true, row: returned[0] };
    }
    const existing = this.findByDedupeKey({
      hogletTaskId: data.hogletTaskId,
      source: data.source,
      payloadHash: data.payloadHash,
    });
    if (!existing) {
      throw new Error(
        `Insert conflict but no existing row for feedback event ${id}`,
      );
    }
    return { inserted: false, row: existing };
  }

  listForNest(nestId: string, limit: number): FeedbackEvent[] {
    return this.db
      .select()
      .from(hedgemonyFeedbackEvents)
      .where(eq(hedgemonyFeedbackEvents.nestId, nestId))
      .orderBy(desc(hedgemonyFeedbackEvents.injectedAt))
      .limit(limit)
      .all();
  }
}
