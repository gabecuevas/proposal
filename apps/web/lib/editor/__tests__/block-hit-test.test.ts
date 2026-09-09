import { describe, expect, it } from "vitest";
import { clampInsertGapTop, hitTestBlocks, type TopLevelBlock } from "../block-hit-test";

const blocks: TopLevelBlock[] = [
  { index: 0, pos: 0, size: 10, top: 48, bottom: 100 },
  { index: 1, pos: 10, size: 20, top: 112, bottom: 180 },
];

describe("hitTestBlocks", () => {
  it("returns a gap above the first block, clamped to the top margin", () => {
    expect(hitTestBlocks(20, blocks, 1056)).toEqual({
      kind: "gap",
      insertPos: 0,
      topPx: 48,
    });
  });

  it("treats the top edge of the first block as insert-above", () => {
    expect(hitTestBlocks(50, blocks, 1056)).toEqual({
      kind: "gap",
      insertPos: 0,
      topPx: 48,
    });
  });

  it("returns the block under the pointer", () => {
    expect(hitTestBlocks(80, blocks, 1056)).toEqual({ kind: "block", block: blocks[0] });
    expect(hitTestBlocks(150, blocks, 1056)).toEqual({ kind: "block", block: blocks[1] });
  });

  it("returns a gap between two blocks", () => {
    expect(hitTestBlocks(106, blocks, 1056)).toEqual({
      kind: "gap",
      insertPos: 10,
      topPx: 106,
    });
  });

  it("returns a gap below the last block so another element can be added", () => {
    expect(hitTestBlocks(400, blocks, 1056)).toEqual({
      kind: "gap",
      insertPos: 30,
      topPx: 194,
    });
  });

  it("hides the insert gap on empty paper until the first block exists", () => {
    expect(hitTestBlocks(80, [], 1056)).toBeNull();
  });

  it("ignores coordinates outside the paper", () => {
    expect(hitTestBlocks(-1, blocks, 1056)).toBeNull();
    expect(hitTestBlocks(1057, blocks, 1056)).toBeNull();
  });
});

describe("clampInsertGapTop", () => {
  it("keeps the insert line inside page margins", () => {
    expect(clampInsertGapTop(10, 1056)).toBe(48);
    expect(clampInsertGapTop(1040, 1056)).toBe(1008);
  });

  it("rejects positions in the gutter between pages", () => {
    // Page 0 ends at 1056; gap is 32px before page 1.
    expect(clampInsertGapTop(1060, 1056 + 32 + 1056, { pageHeightPx: 1056, gapPx: 32 })).toBeNull();
  });
});
