import { describe, expect, it } from "vitest";
import {
  childIndexesNeedingBreakBefore,
  forcedBreakContentMarginPx,
  forcedBreakMinSeamPx,
  forcedBreakSpacerHeight,
  flowSpacerHeightForBreak,
  rangeOverlapsSeam,
  validFlowPos,
  visualSeamBand,
  type PageSeamMetrics,
} from "../page-seam";

const letter: PageSeamMetrics = { pageHeight: 1056, margin: 48, gap: 32 };

describe("page seams", () => {
  it("places the first Letter seam in the bottom margin, canvas gap, and next top margin", () => {
    expect(visualSeamBand(0, letter)).toEqual({ top: 1008, bottom: 1136 });
  });

  it("treats a line through the page gap as overlapping the seam", () => {
    expect(rangeOverlapsSeam(1022, 1042, letter)).toBe(true);
    expect(rangeOverlapsSeam(1056, 1080, letter)).toBe(true);
    expect(rangeOverlapsSeam(62, 82, letter)).toBe(false);
  });

  it("rejects invalid document positions so a bad caret hit cannot crash pagination", () => {
    expect(validFlowPos(3922, -1)).toBeNull();
    expect(validFlowPos(3922, 0)).toBeNull();
    expect(validFlowPos(3922, 3922)).toBeNull();
    expect(validFlowPos(3922, 2846)).toBe(2846);
  });

  it("fills the rest of the sheet after an explicit page break", () => {
    expect(forcedBreakSpacerHeight(100, 1056, 32, 48, 128)).toBe(1036);
    expect(forcedBreakSpacerHeight(1008, 1056, 32, 48, 128)).toBe(128);
  });

  it("uses only the canvas gap after a full-sheet page image", () => {
    expect(forcedBreakContentMarginPx(true, 48)).toBe(0);
    expect(forcedBreakMinSeamPx(true, 32, 128)).toBe(32);
    expect(forcedBreakSpacerHeight(1056, 1056, 32, 0, 32)).toBe(32);
  });

  it("never compounds PDF page seams from a missed measurement or text-flow fallback", () => {
    const letter = { pageHeightPx: 1056, gapPx: 32, marginPx: 48, defaultSeamPx: 128 };
    expect(
      flowSpacerHeightForBreak({
        pageBacked: true,
        followingIsPageCanvas: true,
        measuredBottomPx: null,
        ...letter,
      }),
    ).toBe(32);
    expect(
      flowSpacerHeightForBreak({
        pageBacked: true,
        followingIsPageCanvas: true,
        measuredBottomPx: 1100,
        ...letter,
      }),
    ).toBe(32);
    expect(
      flowSpacerHeightForBreak({
        pageBacked: true,
        followingIsPageCanvas: false,
        measuredBottomPx: 100,
        ...letter,
      }),
    ).toBe(32);
    expect(
      flowSpacerHeightForBreak({
        pageBacked: false,
        followingIsPageCanvas: false,
        measuredBottomPx: null,
        ...letter,
      }),
    ).toBe(128);
  });

  it("breaks before a pricing-table row that would overflow the printable page", () => {
    expect(
      childIndexesNeedingBreakBefore(
        [
          { contentTop: 0, contentBottom: 28 },
          { contentTop: 28, contentBottom: 56 },
          { contentTop: 940, contentBottom: 980 },
        ],
        960,
      ),
    ).toEqual([2]);
  });
});
