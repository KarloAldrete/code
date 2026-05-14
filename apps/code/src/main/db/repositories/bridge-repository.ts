import { and, eq, isNull, or } from "drizzle-orm";
import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { hedgemonyNestBridge } from "../schema";
import type { DatabaseService } from "../service";

export type Bridge = typeof hedgemonyNestBridge.$inferSelect;
export type NewBridge = typeof hedgemonyNestBridge.$inferInsert;

export type BridgeKind =
  | "signal_forward"
  | "scratchpad_ref"
  | "pr_dep"
  | "shared_doc";

export type BridgeCreatedBy = "builder" | "operator";

export interface CreateBridgeData {
  nestAId: string;
  nestBId: string;
  kind: BridgeKind;
  payloadJson: string;
  createdBy: BridgeCreatedBy;
}

@injectable()
export class BridgeRepository {
  constructor(
    @inject(MAIN_TOKENS.DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  insert(data: CreateBridgeData): Bridge {
    const id = crypto.randomUUID();
    const row: NewBridge = {
      id,
      nestAId: data.nestAId,
      nestBId: data.nestBId,
      kind: data.kind,
      payloadJson: data.payloadJson,
      createdBy: data.createdBy,
      createdAt: new Date().toISOString(),
      removedAt: null,
    };
    this.db.insert(hedgemonyNestBridge).values(row).run();
    const created = this.findById(id);
    if (!created) {
      throw new Error(`Failed to create bridge ${id}`);
    }
    return created;
  }

  findById(id: string): Bridge | null {
    return (
      this.db
        .select()
        .from(hedgemonyNestBridge)
        .where(eq(hedgemonyNestBridge.id, id))
        .get() ?? null
    );
  }

  listOpen(): Bridge[] {
    return this.db
      .select()
      .from(hedgemonyNestBridge)
      .where(isNull(hedgemonyNestBridge.removedAt))
      .all();
  }

  listOpenForNest(nestId: string): Bridge[] {
    return this.db
      .select()
      .from(hedgemonyNestBridge)
      .where(
        and(
          or(
            eq(hedgemonyNestBridge.nestAId, nestId),
            eq(hedgemonyNestBridge.nestBId, nestId),
          ),
          isNull(hedgemonyNestBridge.removedAt),
        ),
      )
      .all();
  }

  remove(id: string): void {
    this.db
      .update(hedgemonyNestBridge)
      .set({ removedAt: new Date().toISOString() })
      .where(eq(hedgemonyNestBridge.id, id))
      .run();
  }
}
