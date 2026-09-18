/**
 * Keep PaginationPlus page seams accurate when TipTap tables are present.
 *
 * PaginationPlus uses floated page chrome. Real `display:table` boxes are BFCs
 * that jump below every float seam (runaway pages). We unwrap table chrome with
 * `display: contents` and lay out each row as a normal-flow block + inline-block
 * cells so rows paginate like paragraphs while keeping column geometry.
 */

export const FLOW_PAGE_CONTENT_HEIGHT_PX = 948; // Letter ≈ 1060 - margins - content margins

/** Apply per-cell widths so inline-block columns match TipTap colwidth / style. */
export function syncFlowTableColumnLayout(root: ParentNode | null | undefined): void {
  if (!root) {
    return;
  }
  const tables = root.querySelectorAll("table.flow-table, .tableWrapper > table, .ProseMirror > table, .ProseMirror table");
  tables.forEach((table) => {
    const el = table as HTMLTableElement;
    el.classList.add("flow-table");
    const firstRow = el.querySelector("tr");
    if (!firstRow) {
      return;
    }
    const cells = [...firstRow.querySelectorAll(":scope > th, :scope > td")] as HTMLElement[];
    if (cells.length === 0) {
      return;
    }

    // Prefer explicit colwidth / width inches; otherwise divide evenly.
    const widthsPx: number[] = cells.map((cell) => {
      const colwidth = cell.getAttribute("colwidth");
      if (colwidth) {
        const first = Number(colwidth.split(",")[0]);
        if (Number.isFinite(first) && first > 0) {
          return first;
        }
      }
      const styleWidth = cell.style.width;
      if (styleWidth) {
        if (styleWidth.endsWith("px")) {
          const n = Number(styleWidth.slice(0, -2));
          if (Number.isFinite(n) && n > 0) {
            return n;
          }
        }
        if (styleWidth.endsWith("in")) {
          const n = Number(styleWidth.slice(0, -2));
          if (Number.isFinite(n) && n > 0) {
            return Math.round(n * 96);
          }
        }
        if (styleWidth.endsWith("%")) {
          const n = Number(styleWidth.slice(0, -1));
          if (Number.isFinite(n) && n > 0) {
            return Math.round((n / 100) * 624);
          }
        }
      }
      return 0;
    });

    const known = widthsPx.filter((w) => w > 0);
    const fallback = known.length
      ? Math.round(known.reduce((a, b) => a + b, 0) / known.length)
      : Math.floor(624 / cells.length);

    const resolved = widthsPx.map((w) => (w > 0 ? w : fallback));
    const total = resolved.reduce((a, b) => a + b, 0) || 1;

    el.style.setProperty(
      "--flow-table-cols",
      resolved.map((w) => `${Math.max(8, Math.round((w / total) * 10000) / 100)}%`).join(" "),
    );

    // Stamp each body cell with a column index width for inline-block layout.
    el.querySelectorAll("tr").forEach((row) => {
      const rowCells = [...row.querySelectorAll(":scope > th, :scope > td")] as HTMLElement[];
      rowCells.forEach((cell, index) => {
        const width = resolved[Math.min(index, resolved.length - 1)] ?? fallback;
        const pct = Math.max(8, Math.round((width / total) * 10000) / 100);
        cell.style.setProperty("--flow-cell-width", `${pct}%`);
        cell.dataset.flowCol = String(index);
      });
    });
  });
}

const PAGINATION_CHROME_CLASS_TOKENS = [
  "rm-pages-wrapper",
  "rm-page-header",
  "rm-page-footer",
  "rm-first-page-header",
  "rm-pagination-gap",
  "rm-page-break",
  "ProseMirror-widget",
] as const;

function isPaginationChrome(el: Element): boolean {
  if (el.hasAttribute("data-rm-pagination")) {
    return true;
  }
  const className = typeof el.className === "string" ? el.className : "";
  return PAGINATION_CHROME_CLASS_TOKENS.some((token) => className.includes(token));
}

/**
 * Collect measurable content boxes. `display: contents` table wrappers have
 * zero-size rects, so walk into them and measure rows / blocks instead.
 */
function collectContentBounds(root: HTMLElement): { top: number; bottom: number } | null {
  let contentBottom = 0;
  let contentTop = Number.POSITIVE_INFINITY;

  const visit = (el: Element) => {
    if (isPaginationChrome(el)) {
      return;
    }
    const style = window.getComputedStyle(el);
    if (style.display === "none") {
      return;
    }

    // Unwrap contents / zero-box wrappers (table, tbody, .tableWrapper).
    if (style.display === "contents") {
      for (const child of el.children) {
        visit(child);
      }
      return;
    }

    // Row boxes can span a page seam while cells sit below the float — measure
    // cells (and other in-flow blocks) so the estimate matches visible content.
    const tag = el.tagName;
    if (tag === "TABLE" || tag === "TBODY" || tag === "THEAD" || tag === "TFOOT" || tag === "TR") {
      for (const child of el.children) {
        visit(child);
      }
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.height <= 0 && el.children.length > 0) {
      for (const child of el.children) {
        visit(child);
      }
      return;
    }
    if (rect.height <= 0) {
      return;
    }

    contentTop = Math.min(contentTop, rect.top);
    contentBottom = Math.max(contentBottom, rect.bottom);
  };

  for (const child of root.children) {
    visit(child);
  }

  if (!Number.isFinite(contentTop) || contentBottom <= contentTop) {
    return null;
  }
  return { top: contentTop, bottom: contentBottom };
}

/**
 * Estimate how many Letter pages the current editor content should occupy,
 * independent of PaginationPlus float widgets (used to detect runaway growth).
 */
export function estimateContentPageCount(
  editorDom: HTMLElement | null | undefined,
  pageContentHeightPx = FLOW_PAGE_CONTENT_HEIGHT_PX,
): number {
  if (!editorDom || pageContentHeightPx <= 0) {
    return 1;
  }

  const bounds = collectContentBounds(editorDom);
  if (!bounds) {
    // Fallback: scrollHeight minus a generous chrome allowance is unreliable when
    // PaginationPlus has already inflated minHeight — clamp using text length.
    const textLen = (editorDom.textContent || "").trim().length;
    if (textLen < 500) {
      return 1;
    }
    return Math.max(1, Math.ceil(textLen / 2800));
  }

  const height = bounds.bottom - bounds.top;
  return Math.max(1, Math.ceil(height / pageContentHeightPx));
}

export function paginationLooksRunaway(input: {
  widgetPages: number;
  estimatedPages: number;
  lastGapPx: number | null;
}): boolean {
  const { widgetPages, estimatedPages, lastGapPx } = input;
  if (widgetPages <= estimatedPages + 1) {
    return false;
  }
  if (widgetPages >= 8 && (lastGapPx ?? 0) > 40) {
    return true;
  }
  return widgetPages > estimatedPages + 3 && (lastGapPx ?? 0) > 20;
}
