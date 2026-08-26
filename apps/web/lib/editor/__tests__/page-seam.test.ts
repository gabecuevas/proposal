import { describe, expect, it } from "vitest";
import {
  childIndexesNeedingBreakBefore,
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
