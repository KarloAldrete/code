import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  IPdfExporter,
  PdfExportRequest,
  PdfExportResult,
} from "@posthog/platform/pdf-exporter";
import { app, BrowserWindow, dialog } from "electron";
import { injectable } from "inversify";
import { logger } from "../utils/logger";

const log = logger.scope("electron-pdf-exporter");

const WRAPPER_WIDTH_PX = 720;
const WRAPPER_HEIGHT_PX = 960;
const WRAPPER_SETTLE_MS = 150;
// Brief delay after repositioning the iframe so the new layout paints
// before we capture it.
const EXPAND_SETTLE_MS = 300;

function sanitizeFilename(name: string): string {
  const trimmed = name.trim().replace(/[\\/:*?"<>|]/g, "-");
  return trimmed.length > 0 ? trimmed : "export";
}

function buildWrapperHtml(pngDataUrl: string): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; padding: 0; background: white; }
  img { display: block; max-width: 100%; height: auto; }
</style>
</head>
<body><img src="${pngDataUrl}" alt="" /></body>
</html>`;
}

interface ExpandedIframe {
  width: number;
  height: number;
  originalBounds: Electron.Rectangle;
  resized: boolean;
}

@injectable()
export class ElectronPdfExporter implements IPdfExporter {
  async exportToPdf(req: PdfExportRequest): Promise<PdfExportResult> {
    const parent =
      BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
    if (!parent) {
      throw new Error("No window available for PDF export");
    }

    const filename = `${sanitizeFilename(req.suggestedFilename)}.pdf`;
    const defaultPath = join(app.getPath("downloads"), filename);

    const saveResult = await dialog.showSaveDialog(parent, {
      title: "Export as PDF",
      defaultPath,
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });

    if (saveResult.canceled || !saveResult.filePath) {
      return { path: null, cancelled: true };
    }

    const expanded = await this.expandIframe(parent, req.iframeSelector);
    let pngBuffer: Buffer;
    try {
      // The iframe is now position:fixed at (0,0) with its full content
      // size — capture exactly that rect.
      const image = await parent.webContents.capturePage({
        x: 0,
        y: 0,
        width: expanded.width,
        height: expanded.height,
      });
      pngBuffer = image.toPNG();
    } finally {
      await this.restoreIframe(parent, req.iframeSelector);
      if (expanded.resized) {
        parent.setBounds(expanded.originalBounds);
      }
    }

    const offscreen = new BrowserWindow({
      show: false,
      width: WRAPPER_WIDTH_PX,
      height: WRAPPER_HEIGHT_PX,
      backgroundColor: "#ffffff",
      webPreferences: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });

    try {
      const pngDataUrl = `data:image/png;base64,${pngBuffer.toString("base64")}`;
      const wrapperHtml = buildWrapperHtml(pngDataUrl);
      const wrapperDataUrl = `data:text/html;charset=utf-8;base64,${Buffer.from(
        wrapperHtml,
        "utf8",
      ).toString("base64")}`;
      await offscreen.loadURL(wrapperDataUrl);
      await new Promise((r) => setTimeout(r, WRAPPER_SETTLE_MS));

      const buffer = await offscreen.webContents.printToPDF({
        printBackground: true,
        pageSize: req.pageSize,
        margins: req.margins,
      });

      await writeFile(saveResult.filePath, buffer);
      log.info("exported PDF", { path: saveResult.filePath });

      return { path: saveResult.filePath, cancelled: false };
    } finally {
      if (!offscreen.isDestroyed()) {
        offscreen.destroy();
      }
    }
  }

  private async expandIframe(
    parent: BrowserWindow,
    selector: string,
  ): Promise<ExpandedIframe> {
    // Reach into the iframe's sandboxed frame to read its document
    // content height. Sandboxed iframes block parent-page access, but the
    // main process can executeJavaScript on any frame in the subtree.
    const iframeFrame = parent.webContents.mainFrame.framesInSubtree.find(
      (f) => f !== parent.webContents.mainFrame,
    );
    if (!iframeFrame) {
      throw new Error("Canvas iframe frame not found in parent webContents");
    }
    const contentHeight = (await iframeFrame.executeJavaScript(
      "Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 100)",
    )) as number;

    // Pull the iframe out of layout flow with position:fixed at (0,0)
    // sized to its full content. This bypasses every ancestor overflow
    // / max-height / fixed-height constraint without touching them.
    // Same-document repositioning preserves the iframe's contentWindow,
    // so the canvas's React state and pending API responses survive.
    const measure = (await parent.webContents.executeJavaScript(
      `(() => {
        const iframe = document.querySelector(${JSON.stringify(selector)});
        if (!iframe) throw new Error("Canvas iframe not found in DOM");
        const w = iframe.getBoundingClientRect().width;
        window.__pdfExportSavedStyle = iframe.getAttribute("style") || "";
        iframe.style.cssText =
          "position: fixed; top: 0; left: 0; width: " + w + "px; " +
          "height: ${contentHeight}px; z-index: 999999; background: white; " +
          "margin: 0; padding: 0; border: 0; max-width: none; max-height: none;";
        return { width: w };
      })()`,
    )) as { width: number };

    const originalBounds = parent.getBounds();
    const requiredHeight = Math.ceil(contentHeight) + 60;
    const resized = originalBounds.height < requiredHeight;
    if (resized) {
      parent.setBounds({ ...originalBounds, height: requiredHeight });
    }

    await new Promise((r) => setTimeout(r, EXPAND_SETTLE_MS));

    return {
      width: Math.max(1, Math.ceil(measure.width)),
      height: Math.max(1, Math.ceil(contentHeight)),
      originalBounds,
      resized,
    };
  }

  private async restoreIframe(
    parent: BrowserWindow,
    selector: string,
  ): Promise<void> {
    await parent.webContents.executeJavaScript(
      `(() => {
        const iframe = document.querySelector(${JSON.stringify(selector)});
        if (!iframe) return;
        const saved = window.__pdfExportSavedStyle;
        if (saved !== undefined) {
          if (saved === "") {
            iframe.removeAttribute("style");
          } else {
            iframe.setAttribute("style", saved);
          }
          delete window.__pdfExportSavedStyle;
        }
      })()`,
    );
  }
}
