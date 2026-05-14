import { and, eq } from "drizzle-orm";
import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { hedgemonyBuilderProposal } from "../schema";
import type { DatabaseService } from "../service";

export type Proposal = typeof hedgemonyBuilderProposal.$inferSelect;
export type NewProposal = typeof hedgemonyBuilderProposal.$inferInsert;

export type ProposalKind = "merge" | "split" | "bridge" | "forward" | "adopt";

export type ProposalStatus =
  | "open"
  | "accepted"
  | "dismissed"
  | "snoozed"
  | "auto_executed";

export interface CreateProposalData {
  kind: ProposalKind;
  primaryNestId?: string | null;
  secondaryNestId?: string | null;
  hogletId?: string | null;
  signalReportId?: string | null;
  evidenceJson: string;
  status?: ProposalStatus;
}

@injectable()
export class ProposalRepository {
  constructor(
    @inject(MAIN_TOKENS.DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  insert(data: CreateProposalData): Proposal {
    const timestamp = new Date().toISOString();
    const id = crypto.randomUUID();
    const row: NewProposal = {
      id,
      kind: data.kind,
      primaryNestId: data.primaryNestId ?? null,
      secondaryNestId: data.secondaryNestId ?? null,
      hogletId: data.hogletId ?? null,
      signalReportId: data.signalReportId ?? null,
      evidenceJson: data.evidenceJson,
      status: data.status ?? "open",
      createdAt: timestamp,
      updatedAt: timestamp,
      resolvedAt: null,
    };
    this.db.insert(hedgemonyBuilderProposal).values(row).run();
    const created = this.findById(id);
    if (!created) {
      throw new Error(`Failed to create proposal ${id}`);
    }
    return created;
  }

  findById(id: string): Proposal | null {
    return (
      this.db
        .select()
        .from(hedgemonyBuilderProposal)
        .where(eq(hedgemonyBuilderProposal.id, id))
        .get() ?? null
    );
  }

  /**
   * Returns the most recent open proposal for the given (kind, primaryNestId,
   * secondaryNestId) tuple. Used by BuilderTickService to dedupe: if an open
   * merge proposal already exists between A and B, don't write a second one.
   */
  findOpenByKindAndPair(
    kind: ProposalKind,
    primaryNestId: string,
    secondaryNestId: string | null,
  ): Proposal | null {
    const open = this.db
      .select()
      .from(hedgemonyBuilderProposal)
      .where(
        and(
          eq(hedgemonyBuilderProposal.kind, kind),
          eq(hedgemonyBuilderProposal.status, "open"),
        ),
      )
      .all();
    return (
      open.find(
        (p) =>
          (p.primaryNestId === primaryNestId &&
            p.secondaryNestId === secondaryNestId) ||
          (p.primaryNestId === secondaryNestId &&
            p.secondaryNestId === primaryNestId),
      ) ?? null
    );
  }

  listOpen(): Proposal[] {
    return this.db
      .select()
      .from(hedgemonyBuilderProposal)
      .where(eq(hedgemonyBuilderProposal.status, "open"))
      .all();
  }

  listAll(): Proposal[] {
    return this.db.select().from(hedgemonyBuilderProposal).all();
  }

  updateStatus(id: string, status: ProposalStatus): Proposal {
    const timestamp = new Date().toISOString();
    const resolvedAt =
      status === "open" || status === "snoozed" ? null : timestamp;
    this.db
      .update(hedgemonyBuilderProposal)
      .set({ status, updatedAt: timestamp, resolvedAt })
      .where(eq(hedgemonyBuilderProposal.id, id))
      .run();
    const updated = this.findById(id);
    if (!updated) {
      throw new Error(`Proposal ${id} not found after status update`);
    }
    return updated;
  }
}
