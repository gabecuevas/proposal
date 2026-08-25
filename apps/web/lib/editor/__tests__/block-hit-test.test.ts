import { describe, expect, it } from "vitest";
import { hitTestBlocks, type TopLevelBlock } from "../block-hit-test";

const blocks: TopLevelBlock[] = [
  { index: 0, pos: 0, size: 10, top: 48, bottom: 100 },
  { index: 1, pos: 10, size: 20, top: 112, bottom: 180 },
];

describe("hitTestBlocks", () => {
  it("returns a gap above the first block", () => {
    expect(hitTestBlocks(20, blocks, 1056)).toEqual({
      kind: "gap",
      insertPos: 0,
      topPx: 36,
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

  it("returns an insert slot on empty paper", () => {
    expect(hitTestBlocks(80, [], 1056)).toEqual({
      kind: "gap",
      insertPos: 0,
      topPx: 48,
    });
  });

  it("ignores coordinates outside the paper", () => {
    expect(hitTestBlocks(-1, blocks, 1056)).toBeNull();
    expect(hitTestBlocks(1057, blocks, 1056)).toBeNull();
  });
});
