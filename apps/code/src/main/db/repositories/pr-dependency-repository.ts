import { and, eq } from "drizzle-orm";
import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { hedgemonyPrDependencies } from "../schema";
import type { DatabaseService } from "../service";

export type PrDependency = typeof hedgemonyPrDependencies.$inferSelect;
export type NewPrDependency = typeof hedgemonyPrDependencies.$inferInsert;

export type PrDependencyState =
  | "pending"
  | "satisfied"
  | "broken"
  | "follow_up";

export interface CreatePrDependencyData {
  nestId: string;
  parentTaskId: string;
  childTaskId: string;
  state: PrDependencyState;
}

@injectable()
export class PrDependencyRepository {
  constructor(
    @inject(MAIN_TOKENS.DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  insert(data: CreatePrDependencyData): PrDependency {
    const timestamp = new Date().toISOString();
    const id = crypto.randomUUID();
    const row: NewPrDependency = {
      id,
      nestId: data.nestId,
      parentTaskId: data.parentTaskId,
      childTaskId: data.childTaskId,
      state: data.state,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.db.insert(hedgemonyPrDependencies).values(row).run();
    const created = this.db
      .select()
      .from(hedgemonyPrDependencies)
      .where(eq(hedgemonyPrDependencies.id, id))
      .get();
    if (!created) {
      throw new Error(`Failed to create pr dependency ${id}`);
    }
    return created;
  }

  /**
   * Idempotent insert. Returns the existing row if a `(nestId, parentTaskId,
   * childTaskId)` edge already exists, otherwise inserts a new `pending` (or
   * caller-provided) row. The schema has no UNIQUE constraint on this triple
   * yet, so we enforce it here. Slice 8's hedgehog can safely call
   * `link_pr_dependency` more than once without producing duplicates.
   */
  insertOrIgnore(data: CreatePrDependencyData): {
    inserted: boolean;
    row: PrDependency;
  } {
    const existing = this.findByTriple({
      nestId: data.nestId,
      parentTaskId: data.parentTaskId,
      childTaskId: data.childTaskId,
    });
    if (existing) {
      return { inserted: false, row: existing };
    }
    return { inserted: true, row: this.insert(data) };
  }

  findById(id: string): PrDependency | null {
    return (
      this.db
        .select()
        .from(hedgemonyPrDependencies)
        .where(eq(hedgemonyPrDependencies.id, id))
        .get() ?? null
    );
  }

  findByTriple(key: {
    nestId: string;
    parentTaskId: string;
    childTaskId: string;
  }): PrDependency | null {
    return (
      this.db
        .select()
        .from(hedgemonyPrDependencies)
        .where(
          and(
            eq(hedgemonyPrDependencies.nestId, key.nestId),
            eq(hedgemonyPrDependencies.parentTaskId, key.parentTaskId),
            eq(hedgemonyPrDependencies.childTaskId, key.childTaskId),
          ),
        )
        .get() ?? null
    );
  }

  findPending(): PrDependency[] {
    return this.db
      .select()
      .from(hedgemonyPrDependencies)
      .where(eq(hedgemonyPrDependencies.state, "pending"))
      .all();
  }

  findByParentTaskId(parentTaskId: string): PrDependency[] {
    return this.db
      .select()
      .from(hedgemonyPrDependencies)
      .where(eq(hedgemonyPrDependencies.parentTaskId, parentTaskId))
      .all();
  }

  findByChildTaskId(childTaskId: string): PrDependency[] {
    return this.db
      .select()
      .from(hedgemonyPrDependencies)
      .where(eq(hedgemonyPrDependencies.childTaskId, childTaskId))
      .all();
  }

  listForNest(nestId: string): PrDependency[] {
    return this.db
      .select()
      .from(hedgemonyPrDependencies)
      .where(eq(hedgemonyPrDependencies.nestId, nestId))
      .all();
  }

  updateState(id: string, state: PrDependencyState): PrDependency {
    const timestamp = new Date().toISOString();
    this.db
      .update(hedgemonyPrDependencies)
      .set({ state, updatedAt: timestamp })
      .where(eq(hedgemonyPrDependencies.id, id))
      .run();
    const updated = this.findById(id);
    if (!updated) {
      throw new Error(`pr dependency ${id} not found after state update`);
    }
    return updated;
  }

  delete(id: string): void {
    this.db
      .delete(hedgemonyPrDependencies)
      .where(eq(hedgemonyPrDependencies.id, id))
      .run();
  }
}
