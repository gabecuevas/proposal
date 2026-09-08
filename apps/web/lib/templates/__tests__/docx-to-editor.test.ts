import { describe, expect, it } from "vitest";
import {
  applyImportLayoutHeuristics,
  enhanceDocxHtmlForPrint,
  htmlToEditorContent,
  packContinuousTextBlock,
  transformDocxParagraph,
} from "../docx-to-editor";

describe("htmlToEditorContent", () => {
  it("preserves bold, italic, and underline marks", () => {
    const nodes = htmlToEditorContent(
      `<p>Normal <strong>Bold</strong> <em>Italic</em> <u>Under</u></p>`,
    );
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.type).toBe("paragraph");
    const texts = (nodes[0]?.content ?? []).filter((n) => n.type === "text");
    expect(texts.some((t) => t.text === "Bold" && t.marks?.some((m) => m.type === "bold"))).toBe(
      true,
    );
    expect(texts.some((t) => t.text === "Italic" && t.marks?.some((m) => m.type === "italic"))).toBe(
      true,
    );
    expect(
      texts.some((t) => t.text === "Under" && t.marks?.some((m) => m.type === "underline")),
    ).toBe(true);
  });

  it("does not leave raw HTML in text nodes", () => {
    const nodes = htmlToEditorContent(
      `<p><span style="font-weight:700">Name</span> here</p><table><tr><td>Cell</td></tr></table>`,
    );
    for (const block of nodes) {
      for (const child of block.content ?? []) {
        if (child.type === "text") {
          expect(child.text ?? "").not.toMatch(/<[^>]+>/);
        }
      }
    }
    expect(JSON.stringify(nodes)).toContain("Name");
    expect(JSON.stringify(nodes)).toContain("Cell");
  });

  it("keeps underscore fill lines as solid fillBlank marks", () => {
    const nodes = htmlToEditorContent(`<p>________________</p><p>Sign here</p>`);
    expect(nodes[0]?.type).toBe("paragraph");
    const fill = (nodes[0]?.content ?? []).find((n) => n.type === "text");
    expect(fill?.marks?.some((m) => m.type === "fillBlank")).toBe(true);
    expect(String(fill?.text ?? "")).toMatch(/^\u00a0+$/);
    expect(nodes[1]?.type).toBe("paragraph");
  });

  it("uses fillBlank for inline blanks inside a sentence", () => {
    const nodes = htmlToEditorContent(`<p>Services: ______________. Done.</p>`);
    const texts = (nodes[0]?.content ?? []).filter((n) => n.type === "text");
    const blank = texts.find((t) => t.marks?.some((m) => m.type === "fillBlank"));
    expect(blank).toBeTruthy();
    expect(String(blank?.text ?? "")).toMatch(/^\u00a0+$/);
  });

  it("centers title class paragraphs and applies layout markers", () => {
    const nodes = htmlToEditorContent(
      `<p class="doc-title">INDEPENDENT CONTRACTOR AGREEMENT</p><p>«sd:c»«sd:i1»(a) Centered indented</p>`,
    );
    expect(nodes[0]?.attrs?.textAlign).toBe("center");
    expect(nodes[1]?.attrs?.textAlign).toBe("center");
    expect(nodes[1]?.attrs?.indent).toBe(1);
    expect(JSON.stringify(nodes[1])).not.toContain("«sd:");
  });

  it("maps left padding to indent", () => {
    const nodes = htmlToEditorContent(`<p style="padding-left: 40px">(a) Clause</p>`);
    expect(nodes[0]?.type).toBe("paragraph");
    expect(nodes[0]?.attrs?.indent).toBe(2);
  });

  it("keeps bullet lists", () => {
    const nodes = htmlToEditorContent(`<ul><li><p>One</p></li><li><p>Two</p></li></ul>`);
    expect(nodes[0]?.type).toBe("bulletList");
    expect(nodes[0]?.content).toHaveLength(2);
  });
});

describe("transformDocxParagraph", () => {
  it("encodes center alignment and indent as markers", () => {
    const next = transformDocxParagraph({
      type: "paragraph",
      alignment: "center",
      indent: { start: "720" },
      children: [{ type: "run", children: [{ type: "text", value: "Title" }] }],
    });
    const first = (next as { children: Array<{ children: Array<{ value: string }> }> }).children[0];
    expect(first?.children?.[0]?.value).toContain("«sd:c»");
    expect(first?.children?.[0]?.value).toContain("«sd:i2»");
  });
});

describe("applyImportLayoutHeuristics", () => {
  it("centers title-like opening paragraphs and indents clauses", () => {
    const nodes = applyImportLayoutHeuristics([
      { type: "paragraph", content: [{ type: "text", text: "INDEPENDENT CONTRACTOR AGREEMENT - SMB" }] },
      { type: "paragraph", content: [{ type: "text", text: "Independent Contractor Services Agreement" }] },
      { type: "paragraph", content: [{ type: "text", text: "(a) Contractor will perform." }] },
    ]);
    expect(nodes[0]?.attrs?.textAlign).toBe("center");
    expect(nodes[1]?.attrs?.textAlign).toBe("center");
    expect(nodes[2]?.attrs?.indent).toBe(1);
  });
});

describe("packContinuousTextBlock", () => {
  it("wraps body copy in a single continuous textBox", () => {
    const packed = packContinuousTextBlock(
      htmlToEditorContent(
        `<p class="doc-title">TITLE</p><p>Intro</p><p><strong>1. Section</strong></p><p style="padding-left:20px">(a) Detail</p>`,
      ),
    );
    expect(packed).toHaveLength(1);
    expect(packed[0]?.type).toBe("textBox");
    expect(packed[0]?.attrs?.boxId).toBe("");
    const types = (packed[0]?.content ?? []).map((n) => n.type);
    expect(types).toEqual(["paragraph", "paragraph", "paragraph", "paragraph"]);
    expect(packed[0]?.content?.[0]?.attrs?.textAlign).toBe("center");
  });

  it("keeps formatting inside the textBox", () => {
    const packed = packContinuousTextBlock(
      htmlToEditorContent(`<p>Hello <strong>World</strong></p>`),
    );
    const para = packed[0]?.content?.[0];
    const bold = (para?.content ?? []).find((n) => n.text === "World");
    expect(bold?.marks?.some((m) => m.type === "bold")).toBe(true);
  });
});

describe("enhanceDocxHtmlForPrint", () => {
  it("wraps content in article and centers the first title", () => {
    const html = enhanceDocxHtmlForPrint(
      `<p><strong>INDEPENDENT CONTRACTOR AGREEMENT</strong></p><p>Body</p>`,
    );
    expect(html).toContain('<article class="docx-import">');
    expect(html).toMatch(/text-align:\s*center/i);
    expect(html).toContain("doc-title");
  });

  it("turns underscore paragraphs into solid signature rules", () => {
    const html = enhanceDocxHtmlForPrint(`<p>__________</p>`);
    expect(html).toContain('hr class="signature-line"');
  });
});
