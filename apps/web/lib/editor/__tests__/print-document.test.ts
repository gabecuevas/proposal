import { describe, expect, it } from "vitest";
import { printDocumentCss, wrapPrintHtml } from "../print-document";
import { pageSizeSpec } from "../page-geometry";
import { TextBox } from "../extensions/text-box";

describe("print document", () => {
  it("emits an @page rule matching the editor page size and margins", () => {
    const html = wrapPrintHtml("<article><p>Hello</p></article>", "letter");
    expect(html).toContain("@page { size: letter; margin: 0.5in; }");
    expect(html).toContain("break-inside: auto");
    expect(html).toContain(".creator-text-box");
    expect(html).toContain("--creator-page-height: 1056px");
    expect(html).toContain("<!DOCTYPE html>");
  });

  it("uses A4 in CSS when the document is A4", () => {
    expect(printDocumentCss(pageSizeSpec("a4"))).toContain("size: A4");
  });
});

describe("textBox", () => {
  it("keeps Enter from splitting the box into a new element", () => {
    expect(TextBox.config.isolating).toBe(true);
    expect(TextBox.config.content).toBe("(paragraph | heading | bulletList | orderedList)+");
    expect(TextBox.config.defining).toBeUndefined();
  });
});
