import { describe, expect, it } from "vitest";
import {
  clampFlowPageMargins,
  detectMarginsFromPastedHtml,
  DEFAULT_FLOW_PAGE_MARGINS,
  setFlowMarginEdge,
  snapMarginInches,
} from "../page-margins";

describe("flow page margins", () => {
  it("defaults to Google Docs Letter 1 inch margins", () => {
    expect(DEFAULT_FLOW_PAGE_MARGINS).toEqual({
      topInches: 1,
      rightInches: 1,
      bottomInches: 1,
      leftInches: 1,
    });
  });

  it("snaps to eighth-inch notches", () => {
    expect(snapMarginInches(0.7)).toBe(0.75);
    expect(snapMarginInches(0.1)).toBe(0.125);
  });

  it("keeps a minimum content width when clamping", () => {
    const next = clampFlowPageMargins(
      { topInches: 1, rightInches: 4, bottomInches: 1, leftInches: 4 },
      8.5,
      11,
    );
    expect(next.leftInches + next.rightInches).toBeLessThanOrEqual(8);
  });

  it("updates a single edge with snap + clamp", () => {
    const next = setFlowMarginEdge(
      { ...DEFAULT_FLOW_PAGE_MARGINS },
      "left",
      0.48,
      8.5,
      11,
    );
    expect(next.leftInches).toBe(0.5);
    expect(next.rightInches).toBe(1);
  });

  it("detects @page margins from pasted HTML", () => {
    const html = `<html><style>@page { margin: 0.5in; }</style><body><p>Hi</p></body></html>`;
    expect(detectMarginsFromPastedHtml(html)).toEqual({
      topInches: 0.5,
      rightInches: 0.5,
      bottomInches: 0.5,
      leftInches: 0.5,
    });
  });
});
