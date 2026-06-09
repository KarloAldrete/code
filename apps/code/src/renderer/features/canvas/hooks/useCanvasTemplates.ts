import type { CanvasTemplateSummary } from "@main/services/canvas-templates/schemas";
import { useTRPC } from "@renderer/trpc/client";
import { useQuery } from "@tanstack/react-query";

/** The canvas templates the create-picker offers (built-ins + future user ones). */
export function useCanvasTemplates(): CanvasTemplateSummary[] {
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.canvasTemplates.list.queryOptions(undefined, { staleTime: 60_000 }),
  );
  return data ?? [];
}
