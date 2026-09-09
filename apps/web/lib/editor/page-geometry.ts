/**
 * Page sizes at the CSS 96dpi reference. Overlay fields anchor to
 * `page + fraction of a page`, so the live paper height has to match these
 * values (see `--creator-page-height` on `.creator-paper`).
 */

export const CREATOR_PAPER_SELECTOR = "[data-creator-paper]";

export type PageSizeId = "letter" | "a4" | "legal";

export type PageSizeSpec = {
  id: PageSizeId;
  label: string;
  /** Short label for the page strip. */
  shortLabel: string;
  widthPx: number;
  heightPx: number;
  /** Print-safe inset from each edge, in CSS pixels at 96dpi. */
  marginPx: number;
};

/**
 * Tightest margin that still prints on typical office printers and in PDF
 * export. 0.5in is Word/Google Docs "Narrow" and sits outside the ~0.25in
 * hardware unprintable region of most laser/inkjet devices. Playwright PDF
 * uses this padding as the page margin (`preferCSSPageSize`, zero Chromium
 * margin), so shrinking further would clip on standard printers.
 */
export const PRINT_SAFE_MARGIN_IN = 0.5;
export const PRINT_SAFE_MARGIN_PX = Math.round(PRINT_SAFE_MARGIN_IN * 96);

/** US Letter at 96dpi: 8.5in × 11in. */
export const PAGE_SIZES: Record<PageSizeId, PageSizeSpec> = {
  letter: {
    id: "letter",
    label: "US Letter (8.5 × 11 in)",
    shortLabel: "Letter",
    widthPx: 816,
    heightPx: 1056,
    marginPx: PRINT_SAFE_MARGIN_PX,
  },
  a4: {
    id: "a4",
    label: "A4 (210 × 297 mm)",
    shortLabel: "A4",
    widthPx: 794,
    heightPx: 1123,
    marginPx: PRINT_SAFE_MARGIN_PX,
  },
  legal: {
    id: "legal",
    label: "US Legal (8.5 × 14 in)",
    shortLabel: "Legal",
    widthPx: 816,
    heightPx: 1344,
    marginPx: PRINT_SAFE_MARGIN_PX,
  },
};

export const DEFAULT_PAGE_SIZE: PageSizeId = "letter";

/** @deprecated Prefer `pageSizeSpec().widthPx`. Kept as the Letter default. */
export const PAGE_WIDTH_PX = PAGE_SIZES.letter.widthPx;
/** @deprecated Prefer `pageSizeSpec().heightPx`. Kept as the Letter default. */
export const PAGE_HEIGHT_PX = PAGE_SIZES.letter.heightPx;
export const PAGE_MARGIN_PX = PAGE_SIZES.letter.marginPx;
export const TEXT_COLUMN_WIDTH_PX = PAGE_WIDTH_PX - PAGE_MARGIN_PX * 2;

/**
 * Grey gap between stacked sheets in the editor. Print/PDF omit this — `@page`
 * margins already separate sheets — so field math uses the gap only on screen.
 */
export const PAGE_GAP_PX = 32;

export function parsePageSize(value: unknown): PageSizeId {
  if (value === "a4" || value === "legal" || value === "letter") {
    return value;
  }
  return DEFAULT_PAGE_SIZE;
}

export function pageSizeSpec(id: unknown): PageSizeSpec {
  return PAGE_SIZES[parsePageSize(id)];
}

export function pageSizeFromDoc(doc: { attrs?: Record<string, unknown> } | null | undefined): PageSizeId {
  return parsePageSize(doc?.attrs?.pageSize);
}

/** Merge a page size onto an editor document so it survives save/load. */
export function withPageSize<T extends { attrs?: Record<string, unknown> }>(doc: T, pageSize: PageSizeId): T {
  return {
    ...doc,
    attrs: { ...doc.attrs, pageSize },
  };
}

/** Printable body height inside one sheet (page minus top and bottom margins). */
export function pageContentHeightPx(pageHeightPx = PAGE_HEIGHT_PX, marginPx = PAGE_MARGIN_PX): number {
  return Math.max(1, pageHeightPx - 2 * marginPx);
}

/** Screen-only spacer: bottom margin + gap between sheets + next top margin. */
export function flowBreakHeightPx(marginPx = PAGE_MARGIN_PX, gapPx = PAGE_GAP_PX): number {
  return 2 * marginPx + gapPx;
}

/** How many letter-sized pages the given rendered content height spills onto. */
export function pageCountForHeight(contentHeightPx: number, pageHeightPx = PAGE_HEIGHT_PX): number {
  if (!Number.isFinite(contentHeightPx) || contentHeightPx <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(contentHeightPx / pageHeightPx));
}

/**
 * Total painted height of n stacked sheets with a canvas gap between them.
 */
export function stackedPaperHeightPx(
  pageCount: number,
  pageHeightPx = PAGE_HEIGHT_PX,
  gapPx = PAGE_GAP_PX,
): number {
  const n = Math.max(1, Math.trunc(pageCount) || 1);
  return n * pageHeightPx + (n - 1) * gapPx;
}

/**
 * Page count when sheets are stacked with a visual gap between them
 * (`n * pageHeight + (n - 1) * gap`).
 */
export function pageCountForPaperHeight(
  paperHeightPx: number,
  pageHeightPx = PAGE_HEIGHT_PX,
  gapPx = PAGE_GAP_PX,
): number {
  if (!Number.isFinite(paperHeightPx) || paperHeightPx <= 0) {
    return 1;
  }
  const stride = pageHeightPx + gapPx;
  return Math.max(1, Math.ceil((paperHeightPx + gapPx) / stride - 1e-6));
}

/** Page index (0-based) containing a y offset measured from the top of the paper. */
export function pageAtOffset(offsetPx: number, pageHeightPx = PAGE_HEIGHT_PX): number {
  return Math.max(0, Math.floor(offsetPx / pageHeightPx));
}

/** Page index when sheets are stacked with a visual gap between them. */
export function pageAtVisualOffset(
  offsetPx: number,
  pageHeightPx = PAGE_HEIGHT_PX,
  gapPx = PAGE_GAP_PX,
): number {
  const stride = pageHeightPx + gapPx;
  const page = Math.max(0, Math.floor(Math.max(0, offsetPx) / stride));
  const yInStride = Math.max(0, offsetPx) - page * stride;
  if (yInStride > pageHeightPx) {
    return page + 1;
  }
  return page;
}

/** Y offset of the top of a page in stacked-with-gap coordinates. */
export function visualTopForPage(
  pageIndex: number,
  pageHeightPx = PAGE_HEIGHT_PX,
  gapPx = PAGE_GAP_PX,
): number {
  return Math.max(0, pageIndex) * (pageHeightPx + gapPx);
}

/** Thumbnail clip height so a Letter (or current) sheet keeps its aspect. */
export function pageThumbHeightPx(thumbWidthPx: number, pageWidthPx: number, pageHeightPx: number): number {
  if (!(thumbWidthPx > 0) || !(pageWidthPx > 0) || !(pageHeightPx > 0)) {
    return 1;
  }
  return Math.round(thumbWidthPx * (pageHeightPx / pageWidthPx));
}

/**
 * CSS transform for a full-document clone clipped to one sheet.
 * Translate in page pixels first, then scale — the other order moves page 2+
 * out of the thumbnail window.
 */
export function pageThumbContentTransform(
  pageIndex: number,
  pageHeightPx = PAGE_HEIGHT_PX,
  gapPx = PAGE_GAP_PX,
  scale = 1,
): string {
  const y = visualTopForPage(pageIndex, pageHeightPx, gapPx);
  return `scale(${scale}) translateY(${-y}px)`;
}

/** Live paper height from CSS, so overlay math follows the selected page size. */
export function readPaperPageHeightPx(from?: Element | null): number {
  const paper =
    (from?.closest?.(CREATOR_PAPER_SELECTOR) as HTMLElement | null) ??
    (typeof document === "undefined" ? null : (document.querySelector(CREATOR_PAPER_SELECTOR) as HTMLElement | null));
  if (!paper) {
    return PAGE_HEIGHT_PX;
  }
  const raw = getComputedStyle(paper).getPropertyValue("--creator-page-height");
  const parsed = Number.parseFloat(raw);
  return parsed > 0 ? parsed : PAGE_HEIGHT_PX;
}

export function readPaperPageGapPx(from?: Element | null): number {
  const paper =
    (from?.closest?.(CREATOR_PAPER_SELECTOR) as HTMLElement | null) ??
    (typeof document === "undefined" ? null : (document.querySelector(CREATOR_PAPER_SELECTOR) as HTMLElement | null));
  if (!paper) {
    return PAGE_GAP_PX;
  }
  const raw = getComputedStyle(paper).getPropertyValue("--creator-page-gap");
  const parsed = Number.parseFloat(raw);
  return parsed >= 0 ? parsed : PAGE_GAP_PX;
}
