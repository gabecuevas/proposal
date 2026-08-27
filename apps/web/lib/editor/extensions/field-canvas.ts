import { mergeAttributes, Node } from "@tiptap/core";
import { pageContentHeightPx, PAGE_HEIGHT_PX, PAGE_MARGIN_PX } from "../page-geometry";

export const FIELD_CANVAS_DEFAULT_ASPECT = "8.5/11";

/** CSS `aspect-ratio` value keeping each page at its original proportions. */
export function fieldCanvasAspectRatio(width: unknown, height: unknown): string {
  const w = Number(width);
  const h = Number(height);
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
    return `${w}/${h}`;
  }
  return FIELD_CANVAS_DEFAULT_ASPECT;
}

function isStructuralPageNode(type: string | undefined): boolean {
  return type === "pageBreak" || type === "fieldOverlay";
}

/**
 * Uploaded PDFs are one canvas per sheet. A leftover leading pageBreak after
 * delete-page must not drop the document out of page-backed layout.
 */
export function isPageBackedDoc(
  doc:
    | {
        firstChild?: { type: { name: string } } | null;
        childCount?: number;
        child?: (index: number) => { type: { name: string } };
      }
    | null
    | undefined,
): boolean {
  if (!doc) {
    return false;
  }
  if (typeof doc.childCount === "number" && typeof doc.child === "function") {
    for (let i = 0; i < doc.childCount; i += 1) {
      const name = doc.child(i).type.name;
      if (isStructuralPageNode(name)) {
        continue;
      }
      return name === "fieldCanvas";
    }
    return false;
  }
  return doc.firstChild?.type.name === "fieldCanvas";
}

export function isPageBackedEditorJson(doc: { content?: Array<{ type?: string }> } | null | undefined): boolean {
  for (const node of doc?.content ?? []) {
    if (isStructuralPageNode(node.type)) {
      continue;
    }
    return node.type === "fieldCanvas";
  }
  return false;
}

/**
 * Editor height of a page canvas. Page-backed uploads fill the sheet so a
 * Letter scan maps 1:1; a canvas dropped into a text document stays in the
 * printable column and cannot overflow onto the next sheet.
 */
export function fieldCanvasEditorHeightPx(
  pageBacked: boolean,
  pageHeightPx = PAGE_HEIGHT_PX,
  marginPx = PAGE_MARGIN_PX,
): number {
  return pageBacked ? pageHeightPx : pageContentHeightPx(pageHeightPx, marginPx);
}

export const FieldCanvas = Node.create({
  name: "fieldCanvas",
  group: "block",
  content: "(signerField | textBox)*",
  isolating: true,

  addAttributes() {
    return {
      /** Object store key of the page background image, empty for a blank canvas. */
      bgKey: { default: "" },
      /** 1-based page number when this canvas came from a multi-page upload. */
      pageNumber: { default: 0 },
      pageWidth: { default: 0 },
      pageHeight: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-node-type="fieldCanvas"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-node-type": "fieldCanvas",
        "data-field-canvas": "true",
        class: "field-canvas",
      }),
      0,
    ];
  },
});
