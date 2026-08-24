import { mergeAttributes, Node } from "@tiptap/core";

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

export const FieldCanvas = Node.create({
  name: "fieldCanvas",
  group: "block",
  content: "signerField*",
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
