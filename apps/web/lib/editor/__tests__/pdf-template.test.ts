import { describe, expect, it } from "vitest";
import { buildPageBackedEditorDoc, inferPageSizeFromPdfPoints, templateNameFromFileName } from "../pdf-template";
import {
  fieldCanvasEditorHeightPx,
  isPageBackedEditorJson,
} from "../extensions/field-canvas";
import { pageCountForPaperHeight, PAGE_GAP_PX, PAGE_HEIGHT_PX, stackedPaperHeightPx } from "../page-geometry";
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
    expect(
      pageCountFromEditor({
        type: "doc",
        content: [
          { type: "fieldCanvas", attrs: { bgKey: "a" } },
          { type: "pageBreak" },
          { type: "fieldCanvas", attrs: { bgKey: "b" } },
          { type: "pageBreak" },
        ],
      }),
    ).toBe(2);
  });

  it("treats the upload as page-backed so each canvas fills one sheet", () => {
    const twoPage = buildPageBackedEditorDoc(pages.slice(0, 2));
    expect(isPageBackedEditorJson(twoPage)).toBe(true);
    expect(isPageBackedEditorJson({ type: "doc", content: [{ type: "pageBreak" }, { type: "fieldCanvas" }] })).toBe(
      true,
    );
    expect(isPageBackedEditorJson({ type: "doc", content: [{ type: "paragraph" }] })).toBe(false);
    expect(fieldCanvasEditorHeightPx(true)).toBe(PAGE_HEIGHT_PX);
    expect(fieldCanvasEditorHeightPx(false)).toBe(PAGE_HEIGHT_PX - 96);
    expect(
      pageCountForPaperHeight(
        stackedPaperHeightPx(2, fieldCanvasEditorHeightPx(true), PAGE_GAP_PX),
        PAGE_HEIGHT_PX,
        PAGE_GAP_PX,
      ),
    ).toBe(2);
  });

  it("exposes the first page as the gallery thumbnail", () => {
    expect(templateThumbnailKey(buildPageBackedEditorDoc(pages))).toBe(pages[0]!.key);
  });

  it("records the PDF paper size on the document", () => {
    expect(buildPageBackedEditorDoc(pages).attrs?.pageSize).toBe("letter");
    expect(
      buildPageBackedEditorDoc([{ key: "a", pageNumber: 1, width: 595.28, height: 841.89 }]).attrs?.pageSize,
    ).toBe("a4");
  });

  it("falls back to an empty paragraph when there are no pages", () => {
    expect(buildPageBackedEditorDoc([])).toEqual({
      type: "doc",
      attrs: { pageSize: "letter" },
      content: [{ type: "paragraph" }],
    });
  });
});

describe("inferPageSizeFromPdfPoints", () => {
  it("recognizes Letter, A4, and Legal from the PDF page box", () => {
    expect(inferPageSizeFromPdfPoints(612, 792)).toBe("letter");
    expect(inferPageSizeFromPdfPoints(595.28, 841.89)).toBe("a4");
    expect(inferPageSizeFromPdfPoints(612, 1008)).toBe("legal");
    expect(inferPageSizeFromPdfPoints(792, 612)).toBe("letter");
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
