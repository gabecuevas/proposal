import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * Solid underline blanks for DOCX fill lines (underscores look dashed).
 * Renders as a continuous border-bottom, not text-decoration.
 */
export const FillBlank = Mark.create({
  name: "fillBlank",
  inclusive: false,
  excludes: "underline",

  parseHTML() {
    return [
      { tag: "span.fill-blank" },
      { tag: "span[data-fill-blank]" },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "fill-blank",
        "data-fill-blank": "true",
      }),
      0,
    ];
  },
});
