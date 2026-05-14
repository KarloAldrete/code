import { spawnHogletArgs } from "../hedgehog-tools";
import {
  clampReasoningEffortForAdapter,
  defaultModelForAdapter,
  defaultReasoningEffortForAdapter,
} from "../schemas";
import type { HandlerResult, HedgehogToolHandler } from "./types";
import { recordToolValidationError, stringifyError, truncate } from "./utils";

export const MAX_SPAWN_CALLS_PER_TICK = 3;

export const spawnHogletHandler: HedgehogToolHandler = {
  name: "spawn_hoglet",
  async handle(ctx, block, deps): Promise<HandlerResult> {
    if (ctx.budget.spawnCount >= MAX_SPAWN_CALLS_PER_TICK) {
      deps.writeNestMessage(ctx.nest.id, {
        kind: "audit",
        body: `Hedgehog tried to spawn another hoglet but per-tick cap (${MAX_SPAWN_CALLS_PER_TICK}) was reached.`,
        payloadJson: { type: "spawn_capped", attempted: block.input },
      });
      return { success: false, scratchpadSummary: "spawn_hoglet capped" };
    }
    ctx.budget.spawnCount += 1;

    const parsed = spawnHogletArgs.safeParse(block.input);
    if (!parsed.success) {
      return recordToolValidationError(
        deps,
        ctx.nest.id,
        "spawn_hoglet",
        parsed.error.message,
      );
    }
    const args = parsed.data;
    const repository =
      args.repository ?? ctx.repositoryContext.primaryRepository ?? undefined;

    try {
      const { hoglet, taskRunId } = await deps.hogletService.spawnInNest(
        {
          nestId: ctx.nest.id,
          prompt: args.prompt,
          repository,
        },
        ctx.loadout,
      );
      deps.writeNestMessage(ctx.nest.id, {
        kind: "audit",
        sourceTaskId: hoglet.taskId,
        body: `Spawned hoglet ${hoglet.name ?? hoglet.id}: ${truncate(args.prompt, 200)}`,
        payloadJson: {
          type: "spawned_hoglet",
          hogletId: hoglet.id,
          hogletName: hoglet.name,
          taskId: hoglet.taskId,
          taskRunId,
          repository: repository ?? null,
          repositoryInherited: args.repository === undefined && !!repository,
          model:
            ctx.loadout.model ??
            defaultModelForAdapter(ctx.loadout.runtimeAdapter),
          reasoningEffort: clampReasoningEffortForAdapter(
            ctx.loadout.reasoningEffort ??
              defaultReasoningEffortForAdapter(ctx.loadout.runtimeAdapter),
            ctx.loadout.runtimeAdapter,
          ),
        },
      });
      return {
        success: true,
        scratchpadSummary: `Spawned hoglet ${hoglet.name ?? hoglet.id} (task=${hoglet.taskId})`,
      };
    } catch (error) {
      deps.writeNestMessage(ctx.nest.id, {
        kind: "audit",
        body: `Failed to spawn hoglet: ${stringifyError(error)}`,
        payloadJson: {
          type: "spawn_failed",
          error: stringifyError(error),
          prompt: truncate(args.prompt, 200),
        },
      });
      return {
        success: false,
        scratchpadSummary: `spawn_hoglet errored: ${stringifyError(error)}`,
      };
    }
  },
};
