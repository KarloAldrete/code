export interface PdfPageMargins {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export type PdfPageSize = "Letter" | "A4" | "Legal" | "Tabloid";

export interface PdfExportRequest {
  /**
   * CSS selector that identifies the iframe to capture in the focused
   * window. The adapter expands the iframe to its full content size
   * (overriding ancestor overflow constraints) before capturing, so the
   * resulting PDF contains the entire canvas — not just the visible
   * portion of a scrollable container.
   */
  iframeSelector: string;
  /** Suggested filename for the save dialog (without extension). */
  suggestedFilename: string;
  pageSize: PdfPageSize;
  margins: PdfPageMargins;
}

export type PdfExportResult =
  | { path: string; cancelled: false }
  | { path: null; cancelled: true };

export interface IPdfExporter {
  /**
   * Capture an iframe in the currently focused window and save as a PDF.
   * Shows a native save dialog first; returns cancelled if the user
   * dismisses without saving.
   */
  exportToPdf(request: PdfExportRequest): Promise<PdfExportResult>;
}
