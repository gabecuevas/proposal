/**
 * Measure PaginationPlus visual page bands in editor-local (unscaled) coordinates.
 */
export type FlowPageBand = {
  /** Top of the page relative to the editor element (unscaled CSS px). */
  top: number;
  /** Page height (unscaled CSS px). */
  height: number;
};

/**
 * Returns one band per paper page, skipping `.rm-pagination-gap` strips.
 */
export function measureFlowPageBands(
  editorEl: HTMLElement,
  fallbackPageHeight: number,
  pageCountHint = 1,
): FlowPageBand[] {
  const breakCount = Math.max(
    1,
    pageCountHint,
    editorEl.querySelectorAll("[data-rm-pagination] > .rm-page-break").length,
  );

  const editorRect = editorEl.getBoundingClientRect();
  const scale =
    editorEl.offsetHeight > 0 ? editorRect.height / editorEl.offsetHeight : 1;
  const safeScale = scale > 0.01 ? scale : 1;

  const gapEl = [...editorEl.querySelectorAll(".rm-pagination-gap")].find((el) => {
    const node = el as HTMLElement;
    return node.offsetHeight > 0 && getComputedStyle(node).display !== "none";
  }) as HTMLElement | undefined;

  if (!gapEl) {
    const bands: FlowPageBand[] = [];
    for (let i = 0; i < breakCount; i += 1) {
      bands.push({
        top: i * fallbackPageHeight,
        height:
          breakCount <= 1
            ? Math.min(editorEl.offsetHeight, fallbackPageHeight) || fallbackPageHeight
            : fallbackPageHeight,
      });
    }
    return bands;
  }

  if (breakCount <= 1) {
    return [
      {
        top: 0,
        height: Math.min(editorEl.offsetHeight, fallbackPageHeight) || fallbackPageHeight,
      },
    ];
  }

  const gapRect = gapEl.getBoundingClientRect();
  const measuredFirstPage = (gapRect.top - editorRect.top) / safeScale;
  const pageBandHeight =
    measuredFirstPage > fallbackPageHeight * 0.5 ? measuredFirstPage : fallbackPageHeight;
  const gapHeight = gapRect.height / safeScale;
  const stride = pageBandHeight + gapHeight;

  const bands: FlowPageBand[] = [];
  for (let i = 0; i < breakCount; i += 1) {
    bands.push({
      top: i * stride,
      height: pageBandHeight,
    });
  }
  return bands;
}
