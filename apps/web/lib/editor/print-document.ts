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
article hr { margin: 1.25rem 0; border: none; border-top: 1px solid #e2e8f0; }
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
${printPageBackgroundCss(spec)}
`.trim();
}

/** Full HTML document for Playwright PDF, using the same page box as the editor. */
export function wrapPrintHtml(bodyHtml: string, pageSize?: PageSizeId | unknown): string {
  const spec = pageSizeSpec(pageSize);
  return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${printDocumentCss(spec)}</style></head><body>${bodyHtml}</body></html>`;
}

export function wrapPrintHtmlForDoc(bodyHtml: string, doc: { attrs?: Record<string, unknown> } | null | undefined): string {
  return wrapPrintHtml(bodyHtml, pageSizeFromDoc(doc));
}

/** Opens the same print CSS the PDF pipeline uses, then triggers the browser print dialog. */
export function openPrintPreview(bodyHtml: string, pageSize?: PageSizeId | unknown): void {
  if (typeof window === "undefined") {
    return;
  }
  const popup = window.open("", "_blank", "noopener,noreferrer");
  if (!popup) {
    return;
  }
  popup.document.open();
  popup.document.write(wrapPrintHtml(bodyHtml, pageSize));
  popup.document.close();
  popup.focus();
  popup.print();
}
