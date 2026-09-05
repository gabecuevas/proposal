import { PAGE_GAP_PX, PAGE_MARGIN_PX } from "./page-geometry";

export type TopLevelBlock = {
  index: number;
  pos: number;
  size: number;
  top: number;
  bottom: number;
};

export type BlockHit =
  | { kind: "block"; block: TopLevelBlock }
  | { kind: "gap"; insertPos: number; topPx: number };

/** Pixels at the top of a block that count as "insert above" instead of the block. */
export const INSERT_ABOVE_EDGE_PX = 16;

export type HitTestOptions = {
  marginPx?: number;
  pageHeightPx?: number;
  gapPx?: number;
};

function edgeFor(block: TopLevelBlock): number {
  return Math.min(INSERT_ABOVE_EDGE_PX, Math.max(8, (block.bottom - block.top) / 3));
}

/**
 * Keep the insert + line inside printable content — never in the top/bottom
 * page margins or in the grey gutter between sheets.
 */
export function clampInsertGapTop(
  topPx: number,
  paperHeight: number,
  options: HitTestOptions = {},
): number | null {
  const marginPx = options.marginPx ?? PAGE_MARGIN_PX;
  const pageHeightPx = options.pageHeightPx ?? paperHeight;
  const gapPx = options.gapPx ?? PAGE_GAP_PX;
  if (paperHeight <= marginPx * 2) {
    return null;
  }

  const stride = pageHeightPx + gapPx;
  const pageIndex = Math.max(0, Math.floor(topPx / stride));
  const pageTop = pageIndex * stride;
  const contentTop = pageTop + marginPx;
  const contentBottom = pageTop + pageHeightPx - marginPx;

  // Pointer landed in the inter-page gutter — no insert chrome there.
  if (topPx > pageTop + pageHeightPx && topPx < pageTop + stride) {
    return null;
  }

  if (contentBottom <= contentTop) {
    return null;
  }

  const clamped = Math.max(contentTop, Math.min(topPx, contentBottom));
  if (clamped < 0 || clamped > paperHeight) {
    return null;
  }
  return clamped;
}

function gapHit(
  insertPos: number,
  topPx: number,
  paperHeight: number,
  options: HitTestOptions,
): BlockHit | null {
  const clamped = clampInsertGapTop(topPx, paperHeight, options);
  if (clamped == null) {
    return null;
  }
  return { kind: "gap", insertPos, topPx: clamped };
}

/**
 * Maps a Y offset (relative to the paper) onto either a content block or the
 * empty insert slot above, between, or below blocks. Blank paper (no blocks)
 * returns null — the blank-page starter owns that empty state.
 */
export function hitTestBlocks(
  y: number,
  blocks: TopLevelBlock[],
  paperHeight: number,
  options: HitTestOptions = {},
): BlockHit | null {
  if (y < 0 || y > paperHeight) {
    return null;
  }

  // No insert + until the first real content block exists.
  if (blocks.length === 0) {
    return null;
  }

  const first = blocks[0];
  if (!first) {
    return null;
  }
  if (y < first.top + edgeFor(first)) {
    return gapHit(first.pos, first.top - 2, paperHeight, options);
  }

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (!block) {
      continue;
    }
    const next = blocks[i + 1];
    if (next && y > block.bottom && y < next.top + edgeFor(next)) {
      return gapHit(next.pos, (block.bottom + next.top) / 2, paperHeight, options);
    }
    if (y >= block.top && y <= block.bottom) {
      return { kind: "block", block };
    }
  }

  const last = blocks[blocks.length - 1];
  if (!last) {
    return null;
  }
  if (y > last.bottom) {
    return gapHit(last.pos + last.size, last.bottom + 14, paperHeight, options);
  }

  return null;
}
