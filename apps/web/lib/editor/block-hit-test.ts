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

function edgeFor(block: TopLevelBlock): number {
  return Math.min(INSERT_ABOVE_EDGE_PX, Math.max(8, (block.bottom - block.top) / 3));
}

/**
 * Maps a Y offset (relative to the paper) onto either a content block or the
 * empty insert slot above, between, or below blocks.
 */
export function hitTestBlocks(y: number, blocks: TopLevelBlock[], paperHeight: number): BlockHit | null {
  if (y < 0 || y > paperHeight) {
    return null;
  }

  if (blocks.length === 0) {
    return {
      kind: "gap",
      insertPos: 0,
      topPx: Math.max(12, Math.min(y, paperHeight - 24)),
    };
  }

  const first = blocks[0];
  if (!first) {
    return {
      kind: "gap",
      insertPos: 0,
      topPx: Math.max(12, Math.min(y, paperHeight - 24)),
    };
  }
  if (y < first.top + edgeFor(first)) {
    return { kind: "gap", insertPos: first.pos, topPx: Math.max(12, first.top - 2) };
  }

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i];
    if (!block) {
      continue;
    }
    const next = blocks[i + 1];
    if (next && y > block.bottom && y < next.top + edgeFor(next)) {
      return {
        kind: "gap",
        insertPos: next.pos,
        topPx: (block.bottom + next.top) / 2,
      };
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
    return {
      kind: "gap",
      insertPos: last.pos + last.size,
      topPx: last.bottom + 14,
    };
  }

  return null;
}
