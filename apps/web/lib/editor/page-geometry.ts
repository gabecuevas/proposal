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

/** How many letter-sized pages the given rendered content height spills onto. */
export function pageCountForHeight(contentHeightPx: number, pageHeightPx = PAGE_HEIGHT_PX): number {
  if (!Number.isFinite(contentHeightPx) || contentHeightPx <= 0) {
    return 1;
  }
  return Math.max(1, Math.ceil(contentHeightPx / pageHeightPx));
}

/** Page index (0-based) containing a y offset measured from the top of the paper. */
export function pageAtOffset(offsetPx: number, pageHeightPx = PAGE_HEIGHT_PX): number {
  return Math.max(0, Math.floor(offsetPx / pageHeightPx));
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
