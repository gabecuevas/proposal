import { describe, expect, it } from "vitest";
import { paginationTortureDoc } from "./fixtures/pagination-torture";
import { contentOffsetFromVisual, flowBreakPositions } from "../page-flow";

function walkTypes(node: { type?: string; content?: unknown[] }, into: Set<string>) {
  if (node.type) {
    into.add(node.type);
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      walkTypes(child as { type?: string; content?: unknown[] }, into);
    }
  }
}

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

describe("pagination torture fixture", () => {
  it("contains the difficult layout combinations", () => {
    const types = new Set<string>();
    walkTypes(paginationTortureDoc(), types);
    const required = [
      "heading",
      "paragraph",
      "bulletList",
      "orderedList",
      "listItem",
      "image",
      "pageBreak",
      "textBox",
      "variableToken",
      "quoteTable",
      "table",
      "tableRow",
      "tableCell",
      "fieldOverlay",
      "signerField",
    ];
    for (const type of required) {
      expect(types.has(type)).toBe(true);
    }
    const images = paginationTortureDoc().content.filter((node) => node.type === "image");
    expect(images.some((node) => node.attrs?.widthPct === 100)).toBe(true);
    expect(images.some((node) => node.attrs?.widthPct === 40)).toBe(true);
    expect(paginationTortureDoc().content.filter((node) => node.type === "pageBreak")).toHaveLength(2);
  });

  it("paginates a long paragraph from measured line boxes, not character counts", () => {
    const lineHeight = 24;
    const pageHeight = 960;
    const lines = Array.from({ length: 90 }, (_, index) => ({
      contentTop: index * lineHeight,
      contentBottom: (index + 1) * lineHeight,
      pos: 20 + index,
    }));
    const breaks = flowBreakPositions(lines, pageHeight);
    expect(breaks[0]).toBe(20 + pageHeight / lineHeight);
    expect(breaks.length).toBeGreaterThan(1);
    expect(breaks.every((pos) => typeof pos === "number")).toBe(true);
  });
});
