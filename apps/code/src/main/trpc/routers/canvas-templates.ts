import { z } from "zod";
import { container } from "../../di/container";
import { MAIN_TOKENS } from "../../di/tokens";
import {
  canvasTemplateSchema,
  canvasTemplateSummarySchema,
  getCanvasTemplateInput,
} from "../../services/canvas-templates/schemas";
import type { CanvasTemplatesService } from "../../services/canvas-templates/service";
import { publicProcedure, router } from "../trpc";

const getService = () =>
  container.get<CanvasTemplatesService>(MAIN_TOKENS.CanvasTemplatesService);

export const canvasTemplatesRouter = router({
  list: publicProcedure
    .output(z.array(canvasTemplateSummarySchema))
    .query(() => getService().list()),
  get: publicProcedure
    .input(getCanvasTemplateInput)
    .output(canvasTemplateSchema.nullable())
    .query(({ input }) => getService().get(input.id) ?? null),
});
