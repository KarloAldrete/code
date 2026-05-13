import { asc, eq } from "drizzle-orm";
import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";
import { hedgemonyNestMessages } from "../schema";
import type { DatabaseService } from "../service";

export type NestMessage = typeof hedgemonyNestMessages.$inferSelect;
export type NewNestMessage = typeof hedgemonyNestMessages.$inferInsert;
export type NestMessageKind =
  | "user_message"
  | "hedgehog_message"
  | "audit"
  | "tool_result"
  | "hoglet_summary";
export type NestMessageVisibility = "summary" | "detail";

export interface CreateNestMessageData {
  nestId: string;
  kind: NestMessageKind;
  visibility?: NestMessageVisibility;
  sourceTaskId?: string | null;
  body: string;
  payloadJson?: string | null;
}

const byNestId = (nestId: string) => eq(hedgemonyNestMessages.nestId, nestId);
const now = () => new Date().toISOString();

@injectable()
export class NestMessageRepository {
  constructor(
    @inject(MAIN_TOKENS.DatabaseService)
    private readonly databaseService: DatabaseService,
  ) {}

  private get db() {
    return this.databaseService.db;
  }

  listByNestId(nestId: string): NestMessage[] {
    return this.db
      .select()
      .from(hedgemonyNestMessages)
      .where(byNestId(nestId))
      .orderBy(asc(hedgemonyNestMessages.createdAt))
      .all();
  }

  create(data: CreateNestMessageData): NestMessage {
    const id = crypto.randomUUID();
    const row: NewNestMessage = {
      id,
      nestId: data.nestId,
      kind: data.kind,
      visibility: data.visibility ?? "summary",
      sourceTaskId: data.sourceTaskId ?? null,
      body: data.body,
      payloadJson: data.payloadJson ?? null,
      createdAt: now(),
    };

    this.db.insert(hedgemonyNestMessages).values(row).run();

    const created = this.db
      .select()
      .from(hedgemonyNestMessages)
      .where(eq(hedgemonyNestMessages.id, id))
      .get();

    if (!created) {
      throw new Error(`Failed to create nest message ${id}`);
    }

    return created;
  }
}
