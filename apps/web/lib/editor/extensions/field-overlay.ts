import { mergeAttributes, Node } from "@tiptap/core";

/**
 * A single absolutely positioned layer covering the whole paper, so signer
 * fields can sit on top of text, images, video and tables instead of occupying
 * their own block. Children anchor to a page index plus a fraction of that
 * page, which keeps a field where it was dropped even as the text above it is
 * edited.
 *
 * Documents built from a PDF upload keep using `fieldCanvas`, where each page
 * is its own positioning context.
 */
export const FieldOverlay = Node.create({
  name: "fieldOverlay",
  group: "block",
  content: "signerField*",
  isolating: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'div[data-node-type="fieldOverlay"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-node-type": "fieldOverlay",
        "data-field-overlay": "true",
        class: "field-overlay",
      }),
      0,
    ];
  },
});
