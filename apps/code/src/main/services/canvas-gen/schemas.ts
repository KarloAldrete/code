import { z } from "zod";

// Input for generating / extending a canvas from a chat prompt.
export const canvasGenerateInput = z.object({
  threadId: z.string().min(1),
  prompt: z.string().min(1),
  /**
   * The canvas template whose system prompt anchors the agent. Resolved to the
   * template's prompt in main (CanvasTemplatesService) and applied once when the
   * ephemeral agent session for this thread is created. Defaults to "dashboard".
   */
  templateId: z.string().default("dashboard"),
  model: z.string().optional(),
});
export type CanvasGenerateInput = z.infer<typeof canvasGenerateInput>;

export const canvasThreadInput = z.object({ threadId: z.string().min(1) });
export type CanvasThreadInput = z.infer<typeof canvasThreadInput>;

// Events streamed to the renderer as the agent responds. `spec` carries the
// full assembled json-render Spec snapshot after each applied JSONL patch.
export const canvasStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("started") }),
  z.object({ type: z.literal("prose"), text: z.string() }),
  z.object({
    type: z.literal("spec"),
    spec: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("tool"),
    toolName: z.string(),
    status: z.string(),
  }),
  z.object({ type: z.literal("done") }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);
export type CanvasStreamEvent = z.infer<typeof canvasStreamEventSchema>;

export const CanvasGenEvent = { Event: "canvas-event" } as const;

export interface CanvasGenEventPayload {
  threadId: string;
  event: CanvasStreamEvent;
}

export interface CanvasGenEvents {
  [CanvasGenEvent.Event]: CanvasGenEventPayload;
}
