import { and, asc, eq } from "drizzle-orm";
import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { hedgemonyOperatorDecisions } from "../schema";
import type { DatabaseService } from "../service";

export type OperatorDecision = typeof hedgemonyOperatorDecisions.$inferSelect;
export type NewOperatorDecision =
  typeof hedgemonyOperatorDecisions.$inferInsert;

export type OperatorDecisionKind = "suppress_signal_report" | "revive_hoglet";

export interface RecordSuppressSignalReportInput {
  nestId: string;
  signalReportId: string;
  reason?: string | null;
}

export interface RecordReviveHogletInput {
  nestId: string;
  subjectKey: string;
  reason?: string | null;
}

const bySubject = (
  nestId: string,
  kind: OperatorDecisionKind,
  subjectKey: string,
) =>
  and(
    eq(hedgemonyOperatorDecisions.nestId, nestId),
    eq(hedgemonyOperatorDecisions.kind, kind),
    eq(hedgemonyOperatorDecisions.subjectKey, subjectKey),
  );

@injectable()
export class OperatorDecisionRepository {
  constructor(
    @inject(MAIN_TOKENS.DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  private upsert(
    nestId: string,
    kind: OperatorDecisionKind,
    subjectKey: string,
    reason: string | null,
  ): OperatorDecision {
    const existing =
      this.db
        .select()
        .from(hedgemonyOperatorDecisions)
        .where(bySubject(nestId, kind, subjectKey))
        .get() ?? null;
    if (existing) {
      const updatedAt = new Date().toISOString();
      this.db
        .update(hedgemonyOperatorDecisions)
        .set({ reason, updatedAt })
        .where(bySubject(nestId, kind, subjectKey))
        .run();
      return { ...existing, reason, updatedAt };
    }
    const row: NewOperatorDecision = {
      id: crypto.randomUUID(),
      nestId,
      kind,
      subjectKey,
      reason,
    };
    const returned = this.db
      .insert(hedgemonyOperatorDecisions)
      .values(row)
      .returning()
      .all();
    if (returned.length === 0) {
      throw new Error(
        `Failed to record operator decision ${kind} for ${subjectKey}`,
      );
    }
    return returned[0];
  }

  recordSuppressSignalReport(
    input: RecordSuppressSignalReportInput,
  ): OperatorDecision {
    return this.upsert(
      input.nestId,
      "suppress_signal_report",
      input.signalReportId,
      input.reason ?? null,
    );
  }

  recordReviveHoglet(input: RecordReviveHogletInput): OperatorDecision {
    return this.upsert(
      input.nestId,
      "revive_hoglet",
      input.subjectKey,
      input.reason ?? null,
    );
  }

  listForNest(nestId: string): OperatorDecision[] {
    return this.db
      .select()
      .from(hedgemonyOperatorDecisions)
      .where(eq(hedgemonyOperatorDecisions.nestId, nestId))
      .orderBy(asc(hedgemonyOperatorDecisions.createdAt))
      .all();
  }

  findSuppressed(
    nestId: string,
    signalReportId: string,
  ): OperatorDecision | null {
    return (
      this.db
        .select()
        .from(hedgemonyOperatorDecisions)
        .where(bySubject(nestId, "suppress_signal_report", signalReportId))
        .get() ?? null
    );
  }

  findRevived(nestId: string, hogletKey: string): OperatorDecision | null {
    return (
      this.db
        .select()
        .from(hedgemonyOperatorDecisions)
        .where(bySubject(nestId, "revive_hoglet", hogletKey))
        .get() ?? null
    );
  }
}
