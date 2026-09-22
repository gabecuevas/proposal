import { describe, expect, it } from "vitest";
import { createFlowDocumentExtensions } from "../extensions";
import { FLOW_FIXTURES, type FlowFixtureId } from "../fixtures";
import {
  countExplicitPageBreaks,
  extractFlowPlainText,
  parseFlowDoc,
  serializeFlowDoc,
} from "../serialize";

const FIXTURE_IDS = Object.keys(FLOW_FIXTURES) as FlowFixtureId[];

describe("flow-document fixtures (JSON round-trip)", () => {
  it("exports a TipTap-compatible extension set without Creator overlays", () => {
    const extensions = createFlowDocumentExtensions({ pagination: true });
    const names = extensions.map((extension) => extension.name);
    expect(names).toContain("PaginationPlus");
    expect(names).toContain("pageBreak");
    expect(names).toContain("table");
    expect(names).not.toContain("textBox");
    expect(names).not.toContain("fieldOverlay");
    expect(names).not.toContain("signerField");
    expect(names).not.toContain("fieldCanvas");
    expect(names).not.toContain("pageFlow");
  });

  it("can build extensions without pagination for baseline comparison", () => {
    const names = createFlowDocumentExtensions({ pagination: false }).map((ext) => ext.name);
    expect(names).not.toContain("PaginationPlus");
    expect(names).toContain("pageBreak");
  });

  for (const id of FIXTURE_IDS) {
    it(`round-trips fixture ${id} through serialize/parse without losing text or pageBreaks`, () => {
      const fixture = FLOW_FIXTURES[id];
      const raw = serializeFlowDoc(fixture.doc);
      const restored = parseFlowDoc(raw);
      expect(restored.type).toBe("doc");
      expect(countExplicitPageBreaks(restored)).toBe(countExplicitPageBreaks(fixture.doc));
      expect(extractFlowPlainText(restored).replace(/\s+/g, " ").trim()).toBe(
        extractFlowPlainText(fixture.doc).replace(/\s+/g, " ").trim(),
      );
    });
  }

  it("multi-page fixture retains two explicit page breaks", () => {
    expect(countExplicitPageBreaks(FLOW_FIXTURES["multi-page-breaks"].doc)).toBe(2);
  });

  it("stress fixture contains substantial content", () => {
    const text = extractFlowPlainText(FLOW_FIXTURES["stress-50-pages"].doc);
    expect(text.length).toBeGreaterThan(10_000);
    expect(text).toContain("Section 50");
  });
});

describe("flow-document fidelity harness notes", () => {
  it("documents automated vs clipboard coverage boundaries", () => {
    // This suite validates JSON fixtures + extension composition only.
    // It does NOT prove Google Docs clipboard fidelity or editor↔PDF page parity.
    expect(true).toBe(true);
  });
});
