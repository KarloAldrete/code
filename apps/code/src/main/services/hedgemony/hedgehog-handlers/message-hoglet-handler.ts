import { messageHogletArgs } from "../hedgehog-tools";
import type { HandlerResult, HedgehogToolHandler } from "./types";
import { recordToolValidationError, truncate } from "./utils";

export const messageHogletHandler: HedgehogToolHandler = {
  name: "message_hoglet",
  async handle(ctx, block, deps): Promise<HandlerResult> {
    const parsed = messageHogletArgs.safeParse(block.input);
    if (!parsed.success) {
      return recordToolValidationError(
        deps,
        ctx.nest.id,
        "message_hoglet",
        parsed.error.message,
      );
    }
    const args = parsed.data;
    const entry = ctx.hoglets.find((h) => h.hoglet.id === args.hoglet_id);
    if (!entry) {
      return recordToolValidationError(
        deps,
        ctx.nest.id,
        "message_hoglet",
        `hoglet ${args.hoglet_id} not in this nest`,
      );
    }

    deps.feedbackRouting.emitInject({
      taskId: entry.hoglet.taskId,
      hogletId: entry.hoglet.id,
      nestId: ctx.nest.id,
      source: "hedgehog",
      payloadRef: `hedgehog-message:${ctx.nest.id}:${Date.now()}`,
      payloadHash: `hm-${entry.hoglet.id}-${Date.now()}`,
      prompt: args.prompt,
      prUrl: "",
      fallbackPrompt: args.prompt,
    });

    deps.writeNestMessage(ctx.nest.id, {
      kind: "audit",
      sourceTaskId: entry.hoglet.taskId,
      body: `Messaged hoglet ${args.hoglet_id}: ${truncate(args.prompt, 300)}`,
      payloadJson: {
        type: "message_hoglet_injected",
        hogletId: args.hoglet_id,
        prompt: args.prompt,
      },
    });
    return {
      success: true,
      scratchpadSummary: `message_hoglet injected for ${args.hoglet_id}`,
    };
  },
};
