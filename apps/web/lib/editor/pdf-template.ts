import type { EditorDoc, EditorNode } from "./types";
import { parsePageSize, type PageSizeId, withPageSize } from "./page-geometry";

export type TemplatePageImage = {
  /** Object store key of the rendered page image. */
  key: string;
  pageNumber: number;
  width: number;
  height: number;
};

/**
 * Maps a PDF page's point size onto the closest editor paper. Uploads already
 * know their page count from the PDF itself; this only picks Letter / A4 / Legal
 * so each rasterized page fills one sheet.
 */
export function inferPageSizeFromPdfPoints(widthPt: number, heightPt: number): PageSizeId {
  const portraitW = Math.min(widthPt, heightPt);
  const portraitH = Math.max(widthPt, heightPt);
  const candidates: { id: PageSizeId; w: number; h: number }[] = [
    { id: "letter", w: 612, h: 792 },
    { id: "a4", w: 595.28, h: 841.89 },
    { id: "legal", w: 612, h: 1008 },
  ];
  let best: PageSizeId = "letter";
  let bestDist = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const dist = Math.hypot(portraitW - candidate.w, portraitH - candidate.h);
    if (dist < bestDist) {
      best = candidate.id;
      bestDist = dist;
    }
  }
  return parsePageSize(best);
}

/**
 * Represents an uploaded document as one field canvas per page, so signer fields
 * can be positioned over the original artwork instead of re-flowing its text.
 */
export function buildPageBackedEditorDoc(pages: TemplatePageImage[]): EditorDoc {
  const content: EditorNode[] = [];

  pages.forEach((page, index) => {
    if (index > 0) {
      content.push({ type: "pageBreak" });
    }
    content.push({
      type: "fieldCanvas",
      attrs: {
        bgKey: page.key,
        pageNumber: page.pageNumber,
        pageWidth: page.width,
        pageHeight: page.height,
      },
      content: [],
    });
  });

  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  const pageSize = pages[0] ? inferPageSizeFromPdfPoints(pages[0].width, pages[0].height) : "letter";
  return withPageSize({ type: "doc", content }, pageSize);
}

export function templateNameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base.slice(0, 120) || "Uploaded document";
}
