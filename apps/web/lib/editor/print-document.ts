import { printPageBackgroundCss } from "./page-backgrounds";
import {
  pageSizeFromDoc,
  pageSizeSpec,
  type PageSizeId,
  type PageSizeSpec,
} from "./page-geometry";

function cssPageSize(id: PageSizeId): string {
  if (id === "a4") {
    return "A4";
  }
  return id;
}

/** Shared editor/print typography so Chromium paginates at the same lines. */
export function printDocumentCss(spec: PageSizeSpec): string {
  const marginIn = spec.marginPx / 96;
  const contentWidthPx = spec.widthPx - 2 * spec.marginPx;
  return `
@page { size: ${cssPageSize(spec.id)}; margin: ${marginIn}in; }
html, body { margin: 0; padding: 0; background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
article {
  position: relative;
  width: ${contentWidthPx}px;
  max-width: 100%;
  margin: 0 auto;
  color: #0f172a;
  font-size: 15px;
  line-height: 1.6;
  font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --creator-page-width: ${spec.widthPx}px;
  --creator-page-height: ${spec.heightPx}px;
  --creator-page-margin: ${spec.marginPx}px;
  --creator-page-gap: 0px;
}
article p { margin: 0 0 0.75rem; orphans: 2; widows: 2; }
article h1 { font-size: 1.875rem; font-weight: 600; margin: 0 0 0.75rem; }
article h2 { font-size: 1.375rem; font-weight: 600; margin: 1.25rem 0 0.5rem; }
article h3 { font-size: 1.125rem; font-weight: 600; margin: 1rem 0 0.5rem; }
article h1.doc-title, article p.doc-title, article .doc-title {
  text-align: center;
  font-weight: 700;
}
article ul, article ol { margin: 0 0 0.75rem; padding-left: 1.5rem; }
article ul { list-style-type: disc; }
article ol { list-style-type: decimal; }
article li { display: list-item; }
article [data-indent="1"] { padding-left: 24px; }
article [data-indent="2"] { padding-left: 48px; }
article [data-indent="3"] { padding-left: 72px; }
article [data-indent="4"] { padding-left: 96px; }
article [data-indent="5"] { padding-left: 120px; }
article [data-indent="6"] { padding-left: 144px; }
article [data-indent="7"] { padding-left: 168px; }
article [data-indent="8"] { padding-left: 192px; }
article blockquote { margin: 0 0 0.75rem; border-left: 3px solid #cbd5e1; padding-left: 0.875rem; color: #475569; }
article hr, article hr.signature-line {
  margin: 0.85rem 0 1.15rem;
  border: none;
  border-top: 1.5px solid #0f172a;
  height: 0;
}
article .signature-fill {
  display: inline-block;
  min-width: 12rem;
  border-bottom: 1.5px solid #0f172a;
  vertical-align: baseline;
  height: 1em;
}
article strong, article b { font-weight: 700; }
article em, article i { font-style: italic; }
article u { text-decoration: underline; }
article.docx-import p { margin: 0 0 0.65rem; }
article mark { border-radius: 2px; padding: 0 0.1em; }
.creator-text-box {
  margin: 0 0 0.75rem;
  padding: 0.75rem 0.875rem;
  break-inside: auto;
}
.creator-text-box p:last-child { margin-bottom: 0; }
.overlay-text-box, .rendered-overlay-text-box {
  position: absolute;
  left: calc(var(--field-x) * 100%);
  width: calc(var(--field-w) * 100%);
  margin: 0;
  padding: 6px 10px;
  overflow: hidden;
  box-sizing: border-box;
  background: rgba(255,255,255,0.95);
  font-size: 14px;
  line-height: 1.45;
  color: #0f172a;
}
.rendered-field-canvas .overlay-text-box,
.rendered-field-canvas .rendered-overlay-text-box {
  top: calc(var(--field-y) * 100%);
  height: calc(var(--field-h) * 100%);
}
.rendered-field-overlay .overlay-text-box,
.rendered-field-overlay .rendered-overlay-text-box {
  top: calc(var(--field-y) * var(--creator-page-height, 1056px));
  height: calc(var(--field-h) * var(--creator-page-height, 1056px));
}
.creator-image-block { margin: 0 0 0.75rem; }
img, table { max-width: 100%; }
table { border-collapse: collapse; width: 100%; break-inside: auto; }
tr { break-inside: avoid; page-break-inside: avoid; }
td, th { border: 1px solid #cbd5e1; padding: 6px 8px; }
.quote-table { break-inside: auto; }
.page-break, .creator-flow-break, [data-node-type="pageBreak"] {
  break-before: page;
  height: 0;
  margin: 0;
  border: 0;
}
.creator-flow-break-label { display: none !important; }
article .field-canvas,
article .rendered-field-canvas {
  margin: 0;
  break-inside: avoid;
  page-break-inside: avoid;
  max-height: ${spec.heightPx - 2 * spec.marginPx}px;
}
.certificate-page { break-before: page; }
.rendered-field-overlay {
  --creator-page-gap: 0px;
  --creator-page-height: ${spec.heightPx}px;
}
${printPageBackgroundCss()}
`.trim();
}

function escapeHtmlTitle(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Full HTML document for Playwright PDF, using the same page box as the editor. */
export function wrapPrintHtml(
  bodyHtml: string,
  pageSize?: PageSizeId | unknown,
  title = "Document",
): string {
  const spec = pageSizeSpec(pageSize);
  const safeTitle = escapeHtmlTitle(title.trim() || "Document");
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${safeTitle}</title><style>${printDocumentCss(spec)}</style></head><body>${bodyHtml}</body></html>`;
}

export function wrapPrintHtmlForDoc(bodyHtml: string, doc: { attrs?: Record<string, unknown> } | null | undefined): string {
  return wrapPrintHtml(bodyHtml, pageSizeFromDoc(doc));
}

function openPrintWindow(
  bodyHtml: string,
  pageSize?: PageSizeId | unknown,
  title = "Document",
): Window | null {
  if (typeof window === "undefined") {
    return null;
  }
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) {
    return null;
  }
  popup.document.open();
  popup.document.write(wrapPrintHtml(bodyHtml, pageSize, title));
  popup.document.close();
  popup.focus();
  return popup;
}

/** Opens the same print CSS the PDF pipeline uses, then triggers the browser print dialog. */
export function openPrintPreview(
  bodyHtml: string,
  pageSize?: PageSizeId | unknown,
  title = "Document",
): void {
  const popup = openPrintWindow(bodyHtml, pageSize, title);
  popup?.print();
}

/** Downloads a PDF blob URL (or any binary response) to the user's machine. */
export async function downloadPdfFromUrl(url: string, filename: string): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to download PDF");
  }
  const blob = await response.blob();
  downloadPdfBlob(blob, filename);
}

export function downloadPdfBlob(blob: Blob, filename: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename.endsWith(".pdf") ? filename : `${filename}.pdf`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/** Renders live document HTML to a PDF blob via the server Playwright pipeline. */
export async function renderPdfBlob(input: {
  bodyHtml: string;
  pageSize?: PageSizeId | unknown;
  title?: string;
  filename?: string;
  disposition?: "inline" | "attachment";
}): Promise<Blob> {
  const disposition = input.disposition ?? "inline";
  const response = await fetch(`/api/pdf/render?disposition=${disposition}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bodyHtml: input.bodyHtml,
      pageSize: input.pageSize,
      title: input.title,
      filename: input.filename,
    }),
  });
  if (!response.ok) {
    let detail = "Failed to render PDF";
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        detail = payload.error;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }
  const blob = await response.blob();
  if (blob.type && blob.type !== "application/pdf" && blob.size < 100) {
    throw new Error("PDF render returned an unexpected response");
  }
  return blob;
}

/** Opens a real PDF in a new browser tab. Prefers a finalized artifact when provided. */
export async function openPdfPreview(input: {
  bodyHtml: string;
  pageSize?: PageSizeId | unknown;
  title?: string;
  artifactUrl?: string | null;
}): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }
  if (input.artifactUrl) {
    window.open(input.artifactUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const blob = await renderPdfBlob({
    bodyHtml: input.bodyHtml,
    pageSize: input.pageSize,
    title: input.title,
    filename: `${input.title ?? "document"}.pdf`,
    disposition: "inline",
  });
  const objectUrl = URL.createObjectURL(blob);
  // Avoid noopener here: some browsers blank blob: PDF tabs when the opener is detached.
  const popup = window.open(objectUrl, "_blank");
  if (!popup) {
    downloadPdfBlob(blob, `${input.title ?? "document"}.pdf`);
  }
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

/**
 * Downloads a PDF of the current document.
 * Prefers a finalized artifact URL when provided; otherwise renders via Playwright.
 */
export async function downloadDocumentPdf(input: {
  bodyHtml: string;
  pageSize?: PageSizeId | unknown;
  filename: string;
  artifactUrl?: string | null;
}): Promise<void> {
  const filename = input.filename.trim() || "document.pdf";
  if (input.artifactUrl) {
    await downloadPdfFromUrl(input.artifactUrl, filename);
    return;
  }
  const blob = await renderPdfBlob({
    bodyHtml: input.bodyHtml,
    pageSize: input.pageSize,
    title: filename.replace(/\.pdf$/i, ""),
    filename,
    disposition: "attachment",
  });
  downloadPdfBlob(blob, filename);
}
