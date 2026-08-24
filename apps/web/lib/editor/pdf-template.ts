import type { EditorDoc, EditorNode } from "./types";

export type TemplatePageImage = {
  /** Object store key of the rendered page image. */
  key: string;
  pageNumber: number;
  width: number;
  height: number;
};

/**
 * Represents an uploaded document as one field canvas per page, so signer fields
 * can be positioned over the original artwork instead of re-flowing its text.
 */
export function buildPageBackedEditorDoc(pages: TemplatePageImage[]): EditorDoc {
  const content: EditorNode[] = [];

  pages.forEach((page, index) => {
    if (index > 0) {
      content.push({ type: "pageBreak" });
    }
    content.push({
      type: "fieldCanvas",
      attrs: {
        bgKey: page.key,
        pageNumber: page.pageNumber,
        pageWidth: page.width,
        pageHeight: page.height,
      },
      content: [],
    });
  });

  if (content.length === 0) {
    content.push({ type: "paragraph" });
  }

  return { type: "doc", content };
}

export function templateNameFromFileName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base.slice(0, 120) || "Uploaded document";
}
