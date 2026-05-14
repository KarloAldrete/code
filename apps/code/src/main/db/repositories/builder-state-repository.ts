import { eq } from "drizzle-orm";
import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { hedgemonyBuilderState } from "../schema";
import type { DatabaseService } from "../service";

export type BuilderState = typeof hedgemonyBuilderState.$inferSelect;
export type NewBuilderState = typeof hedgemonyBuilderState.$inferInsert;

export const BUILDER_STATE_SINGLETON_ID = "builder";

export interface UpsertBuilderStateData {
  lastTickAt?: string | null;
  configJson?: string | null;
}

@injectable()
export class BuilderStateRepository {
  constructor(
    @inject(MAIN_TOKENS.DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  get(): BuilderState | null {
    return (
      this.db
        .select()
        .from(hedgemonyBuilderState)
        .where(eq(hedgemonyBuilderState.id, BUILDER_STATE_SINGLETON_ID))
        .get() ?? null
    );
  }

  upsert(data: UpsertBuilderStateData): BuilderState {
    const timestamp = new Date().toISOString();
    const existing = this.get();
    if (existing) {
      this.db
        .update(hedgemonyBuilderState)
        .set({
          lastTickAt: data.lastTickAt ?? existing.lastTickAt,
          configJson: data.configJson ?? existing.configJson,
          updatedAt: timestamp,
        })
        .where(eq(hedgemonyBuilderState.id, BUILDER_STATE_SINGLETON_ID))
        .run();
    } else {
      const row: NewBuilderState = {
        id: BUILDER_STATE_SINGLETON_ID,
        lastTickAt: data.lastTickAt ?? null,
        configJson: data.configJson ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.db.insert(hedgemonyBuilderState).values(row).run();
    }
    const after = this.get();
    if (!after) {
      throw new Error("Failed to upsert builder state row");
    }
    return after;
  }
}
