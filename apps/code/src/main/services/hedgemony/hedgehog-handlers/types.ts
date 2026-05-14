import type { PrDependency } from "../../../db/repositories/pr-dependency-repository";
import type { AnthropicToolUseBlock } from "../../llm-gateway/schemas";
import type { CloudTaskClient } from "../cloud-task-client";
import type { HogletWithState } from "../hedgehog-prompts";
import type { HedgehogToolName } from "../hedgehog-tools";
import type { PrGraphService } from "../pr-graph-service";
import type { Nest } from "../schemas";

/**
 * Per-tick state shared across handler invocations. Handlers that need to
 * enforce per-tick budgets (e.g. raise_hoglet's cap) read and mutate this
 * directly; the dispatcher constructs a fresh instance for each tick.
 */
export class TickBudget {
  raiseCount = 0;
}

export interface TickContext {
  readonly nest: Nest;
  readonly hoglets: HogletWithState[];
  readonly budget: TickBudget;
  /**
   * PR dependency edges in this nest at tick time. Used by Slice 8's PR-graph
   * handlers (link/unlink/rebase) for membership checks and by the user prompt
   * to surface the current graph to the hedgehog.
   */
  readonly prDependencies: PrDependency[];
}

export interface WriteNestMessageInput {
  kind: "hedgehog_message" | "audit" | "tool_result";
  body: string;
  visibility?: "summary" | "detail";
  sourceTaskId?: string | null;
  payloadJson?: Record<string, unknown> | null;
}

export interface HedgehogToolDeps {
  readonly cloudTasks: CloudTaskClient;
  /**
   * Slice 8's PR graph manipulator. Handlers use it to declare new edges,
   * remove them, and proactively trigger rebase routing.
   */
  readonly prGraph: PrGraphService;
  /**
   * Write a message into nest chat and emit the change to subscribers.
   * Closed over by the tick service so handlers don't take direct refs to
   * NestChatService / NestService.
   */
  writeNestMessage(nestId: string, input: WriteNestMessageInput): void;
}

export interface HandlerResult {
  readonly success: boolean;
  readonly scratchpadSummary: string;
}

export interface HedgehogToolHandler {
  readonly name: HedgehogToolName;
  handle(
    ctx: TickContext,
    block: AnthropicToolUseBlock,
    deps: HedgehogToolDeps,
  ): Promise<HandlerResult>;
}
