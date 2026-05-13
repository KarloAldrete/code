import { useTRPC } from "@renderer/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { logger } from "@utils/logger";
import { toast } from "@utils/toast";
import { useCallback } from "react";

const log = logger.scope("export-canvas-pdf");

const CANVAS_IFRAME_SELECTOR = 'iframe[title="rendering-canvas"]';

export function useExportCanvasPdf() {
  const trpcReact = useTRPC();
  const mutation = useMutation(
    trpcReact.canvasExport.exportPdf.mutationOptions(),
  );

  const exportPdf = useCallback(
    async ({ name }: { name: string }) => {
      log.info("exporting canvas to PDF", { name });
      if (!document.querySelector(CANVAS_IFRAME_SELECTOR)) {
        toast.error("Could not export canvas", {
          description: "Canvas iframe not found on the page",
        });
        return;
      }
      try {
        const result = await mutation.mutateAsync({
          name,
          iframeSelector: CANVAS_IFRAME_SELECTOR,
        });
        if (result.cancelled) return;
        toast.success("Canvas exported", { description: result.path });
      } catch (err) {
        log.error("failed to export canvas", err);
        toast.error("Could not export canvas", {
          description: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [mutation],
  );

  return { exportPdf, isExporting: mutation.isPending };
}
