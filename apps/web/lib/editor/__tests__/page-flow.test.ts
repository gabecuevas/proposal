import { describe, expect, it } from "vitest";
import { contentOffsetFromVisual, flowBreakPositions } from "../page-flow";

describe("flowBreakPositions", () => {
  it("does not break when everything fits on one page", () => {
    expect(
      flowBreakPositions(
        [
          { contentTop: 0, contentBottom: 24, pos: 2 },
          { contentTop: 24, contentBottom: 48, pos: 10 },
          { contentTop: 900, contentBottom: 924, pos: 40 },
        ],
        960,
      ),
    ).toEqual([]);
  });

  it("breaks before the first line that would overflow so the same element continues", () => {
    expect(
      flowBreakPositions(
        [
          { contentTop: 0, contentBottom: 24, pos: 2 },
          { contentTop: 936, contentBottom: 960, pos: 80 },
          { contentTop: 960, contentBottom: 984, pos: 120 },
          { contentTop: 984, contentBottom: 1008, pos: 140 },
        ],
        960,
      ),
    ).toEqual([120]);
  });

  it("adds another break when text fills a second page", () => {
    expect(
      flowBreakPositions(
        [
          { contentTop: 0, contentBottom: 960, pos: 2 },
          { contentTop: 960, contentBottom: 1920, pos: 200 },
          { contentTop: 1920, contentBottom: 1944, pos: 400 },
        ],
        960,
      ),
    ).toEqual([200, 400]);
  });

  it("does not insert a break at the start of the document", () => {
    expect(flowBreakPositions([{ contentTop: 0, contentBottom: 24, pos: 1 }], 960)).toEqual([]);
  });
});

describe("contentOffsetFromVisual", () => {
  it("strips page padding and already-rendered spacers", () => {
    expect(contentOffsetFromVisual(1136, 48, 128)).toBe(960);
  });
});
