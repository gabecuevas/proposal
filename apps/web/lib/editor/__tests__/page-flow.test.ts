/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";
import { paginationTortureDoc } from "./fixtures/pagination-torture";
import { createFlowBreakElement, pauseFlowBreaksForMeasure, pauseOverlayHitTesting } from "../extensions/page-flow";
import { contentOffsetFromVisual, flowBreakPositions, selectPageFlowBreaks, canvasSeamPositions } from "../page-flow";

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

describe("selectPageFlowBreaks", () => {
  it("ignores overflow breaks on page-backed PDF uploads", () => {
    expect(selectPageFlowBreaks([5], [5, 12, 40], true)).toEqual([5]);
  });

  it("keeps overflow breaks for flowing text documents", () => {
    expect(selectPageFlowBreaks([80], [200, 400], false)).toEqual([80, 200, 400]);
  });
});

describe("canvasSeamPositions", () => {
  it("places one grey gap before every canvas after the first", () => {
    expect(
      canvasSeamPositions([
        { type: "fieldCanvas", pos: 0 },
        { type: "pageBreak", pos: 10 },
        { type: "fieldCanvas", pos: 11 },
        { type: "pageBreak", pos: 21 },
        { type: "fieldCanvas", pos: 22 },
      ]),
    ).toEqual([11, 22]);
  });

  it("ignores leftover and duplicate pageBreak nodes after delete-page", () => {
    expect(
      canvasSeamPositions([
        { type: "fieldCanvas", pos: 0 },
        { type: "pageBreak", pos: 10 },
        { type: "fieldCanvas", pos: 11 },
        { type: "pageBreak", pos: 21 },
        { type: "pageBreak", pos: 22 },
        { type: "fieldCanvas", pos: 23 },
        { type: "pageBreak", pos: 33 },
      ]),
    ).toEqual([11, 23]);
  });
});

describe("contentOffsetFromVisual", () => {
  it("strips page padding and already-rendered spacers", () => {
    expect(contentOffsetFromVisual(1136, 48, 128)).toBe(960);
  });
});

describe("flow-break spacer widgets", () => {
  it("sets an explicit height so page-backed seams do not depend on CSS inheritance", () => {
    const el = createFlowBreakElement(128);
    expect(el.style.height).toBe("128px");
    expect(el.style.minHeight).toBe("128px");
    expect(el.tagName).toBe("SPAN");
    expect(el.style.display).toBe("block");
    expect(el.getAttribute("data-creator-flow-break")).toBe("true");
  });

  it("hides overlay nodes during measurement and restores them", () => {
    const root = document.createElement("div");
    const overlay = document.createElement("div");
    overlay.className = "field-overlay";
    overlay.style.visibility = "visible";
    root.append(overlay);
    let seen = "";
    pauseOverlayHitTesting(root, () => {
      seen = overlay.style.visibility;
    });
    expect(seen).toBe("hidden");
    expect(overlay.style.visibility).toBe("visible");
  });

  it("pauseFlowBreaksForMeasure is a no-op passthrough for continuous canvas", () => {
    const root = document.createElement("div");
    expect(pauseFlowBreaksForMeasure(root, () => "ok")).toBe("ok");
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
    ];
    for (const type of required) {
      expect(types.has(type)).toBe(true);
    }
  });
});
