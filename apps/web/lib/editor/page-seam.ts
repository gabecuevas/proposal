import {
  PAGE_GAP_PX,
  PAGE_HEIGHT_PX,
  PAGE_MARGIN_PX,
  flowBreakHeightPx,
  pageContentHeightPx,
} from "./page-geometry";
import { flowBreakPositions } from "./page-flow";

export type PageSeamMetrics = {
  pageHeight: number;
  margin: number;
  gap: number;
};

export function pageSeamMetricsFromStyles(source: Element | null | undefined): PageSeamMetrics {
  const paper =
    (source?.closest?.("[data-creator-paper]") as HTMLElement | null) ??
    (source instanceof HTMLElement && source.hasAttribute("data-creator-paper") ? source : null);
  const styles = paper ? getComputedStyle(paper) : source ? getComputedStyle(source) : null;
  const pageHeight =
    Number.parseFloat(styles?.getPropertyValue("--creator-page-height") ?? "") || PAGE_HEIGHT_PX;
  const margin =
    Number.parseFloat(styles?.getPropertyValue("--creator-page-margin") ?? "") || PAGE_MARGIN_PX;
  const gapRaw = Number.parseFloat(styles?.getPropertyValue("--creator-page-gap") ?? "");
  return {
    pageHeight,
    margin,
    gap: Number.isFinite(gapRaw) ? gapRaw : PAGE_GAP_PX,
  };
}

export function printableContentHeight(metrics: PageSeamMetrics): number {
  return pageContentHeightPx(metrics.pageHeight, metrics.margin);
}

export function seamSpacerHeight(metrics: PageSeamMetrics): number {
  return flowBreakHeightPx(metrics.margin, metrics.gap);
}

/** Bottom margin + canvas gap + next top margin, in visual paper/editor coordinates. */
export function visualSeamBand(
  pageIndex: number,
  metrics: PageSeamMetrics,
): { top: number; bottom: number } {
  const pageBottom = pageIndex * (metrics.pageHeight + metrics.gap) + metrics.pageHeight;
  return {
    top: pageBottom - metrics.margin,
    bottom: pageBottom + metrics.gap + metrics.margin,
  };
}

export function rangeOverlapsSeam(
  top: number,
  bottom: number,
  metrics: PageSeamMetrics,
  pageCount = 32,
): boolean {
  if (!(bottom > top)) {
    return false;
  }
  for (let i = 0; i < pageCount; i += 1) {
    const seam = visualSeamBand(i, metrics);
    if (seam.top >= bottom) {
      return false;
    }
    if (top < seam.bottom && bottom > seam.top) {
      return true;
    }
  }
  return false;
}

/** Document positions where a widget may be inserted. */
export function validFlowPos(docSize: number, pos: number | null | undefined): number | null {
  if (pos == null || !Number.isFinite(pos)) {
    return null;
  }
  const next = Math.trunc(pos);
  if (next < 1 || next >= docSize) {
    return null;
  }
  return next;
}

export function spacerHeightAbove(root: HTMLElement, visualY: number): number {
  let height = 0;
  const rootTop = root.getBoundingClientRect().top;
  for (const el of root.querySelectorAll("[data-creator-flow-break]")) {
    const rect = el.getBoundingClientRect();
    const top = rect.top - rootTop;
    if (top + 1 < visualY) {
      height += rect.height;
    }
  }
  return height;
}

/**
 * Indexes of stacked children that must start on the next sheet so they do
 * not paint through a page gap. Used by atom node views (pricing tables)
 * that cannot host ProseMirror widgets inside themselves.
 */
export function childIndexesNeedingBreakBefore(
  children: { contentTop: number; contentBottom: number }[],
  contentHeight: number,
): number[] {
  const lines = children.map((child, index) => ({
    pos: index + 2,
    contentTop: child.contentTop,
    contentBottom: child.contentBottom,
  }));
  return flowBreakPositions(lines, contentHeight).map((pos) => pos - 2);
}
