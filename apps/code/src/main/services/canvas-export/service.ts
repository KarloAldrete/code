import type {
  IPdfExporter,
  PdfExportResult,
} from "@posthog/platform/pdf-exporter";
import { inject, injectable } from "inversify";
import { MAIN_TOKENS } from "../../di/tokens";

@injectable()
export class CanvasExportService {
  constructor(
    @inject(MAIN_TOKENS.PdfExporter) private readonly pdfExporter: IPdfExporter,
  ) {}

  async exportPdf({
    name,
    iframeSelector,
  }: {
    name: string;
    iframeSelector: string;
  }): Promise<PdfExportResult> {
    return this.pdfExporter.exportToPdf({
      iframeSelector,
      suggestedFilename: name,
      pageSize: "Letter",
      margins: { top: 0.5, bottom: 0.5, left: 0.5, right: 0.5 },
    });
  }
}
