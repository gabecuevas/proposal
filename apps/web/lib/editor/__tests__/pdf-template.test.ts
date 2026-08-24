import { describe, expect, it } from "vitest";
import { buildPageBackedEditorDoc, templateNameFromFileName } from "../pdf-template";
import { pageCountFromEditor, templateThumbnailKey } from "@/lib/ui/template-meta";

const pages = [
  { key: "workspaces/w1/uploads/a/page-1.jpg", pageNumber: 1, width: 612, height: 792 },
  { key: "workspaces/w1/uploads/a/page-2.jpg", pageNumber: 2, width: 612, height: 792 },
  { key: "workspaces/w1/uploads/a/page-3.jpg", pageNumber: 3, width: 792, height: 612 },
];

describe("buildPageBackedEditorDoc", () => {
  it("creates one canvas per page separated by page breaks", () => {
    const doc = buildPageBackedEditorDoc(pages);
    const canvases = doc.content.filter((node) => node.type === "fieldCanvas");
    const breaks = doc.content.filter((node) => node.type === "pageBreak");

    expect(canvases).toHaveLength(3);
    expect(breaks).toHaveLength(2);
    expect(canvases[0]?.attrs).toMatchObject({
      bgKey: pages[0]!.key,
      pageNumber: 1,
      pageWidth: 612,
      pageHeight: 792,
    });
  });

  it("preserves per-page dimensions so landscape pages keep their shape", () => {
    const doc = buildPageBackedEditorDoc(pages);
    const landscape = doc.content.filter((node) => node.type === "fieldCanvas")[2];
    expect(landscape?.attrs).toMatchObject({ pageWidth: 792, pageHeight: 612 });
  });

  it("reports a page count matching the uploaded PDF", () => {
    expect(pageCountFromEditor(buildPageBackedEditorDoc(pages))).toBe(3);
  });

  it("exposes the first page as the gallery thumbnail", () => {
    expect(templateThumbnailKey(buildPageBackedEditorDoc(pages))).toBe(pages[0]!.key);
  });

  it("falls back to an empty paragraph when there are no pages", () => {
    expect(buildPageBackedEditorDoc([])).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });
});

describe("templateNameFromFileName", () => {
  it("strips the extension and separators", () => {
    expect(templateNameFromFileName("master_service-agreement.pdf")).toBe(
      "master service agreement",
    );
  });

  it("falls back when the name is only an extension", () => {
    expect(templateNameFromFileName(".pdf")).toBe("Uploaded document");
  });
});
