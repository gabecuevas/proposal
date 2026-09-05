import { describe, expect, it } from "vitest";
import { enhanceDocxHtmlForPrint, htmlToEditorContent } from "../docx-to-editor";

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

  it("converts underscore fill lines to horizontal rules", () => {
    const nodes = htmlToEditorContent(`<p>________________</p><p>Sign here</p>`);
    expect(nodes[0]?.type).toBe("horizontalRule");
    expect(nodes[1]?.type).toBe("paragraph");
  });

  it("centers title headings", () => {
    const nodes = htmlToEditorContent(`<h1 class="doc-title">INDEPENDENT CONTRACTOR AGREEMENT</h1>`);
    expect(nodes[0]?.type).toBe("heading");
    expect(nodes[0]?.attrs?.textAlign).toBe("center");
    expect(nodes[0]?.attrs?.level).toBe(1);
  });

  it("keeps bullet lists", () => {
    const nodes = htmlToEditorContent(`<ul><li><p>One</p></li><li><p>Two</p></li></ul>`);
    expect(nodes[0]?.type).toBe("bulletList");
    expect(nodes[0]?.content).toHaveLength(2);
  });
});

describe("enhanceDocxHtmlForPrint", () => {
  it("wraps content in article and centers the first title", () => {
    const html = enhanceDocxHtmlForPrint(`<p><strong>INDEPENDENT CONTRACTOR AGREEMENT</strong></p><p>Body</p>`);
    expect(html).toContain('<article class="docx-import">');
    expect(html).toMatch(/text-align:\s*center/i);
    expect(html).toContain("doc-title");
  });

  it("turns underscore paragraphs into solid signature rules", () => {
    const html = enhanceDocxHtmlForPrint(`<p>__________</p>`);
    expect(html).toContain('hr class="signature-line"');
  });
});
