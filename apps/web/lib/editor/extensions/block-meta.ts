import { Extension } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

const BLOCK_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "bulletList",
  "orderedList",
  "horizontalRule",
  "textBox",
  "image",
  "youtube",
  "table",
  "quoteTable",
  "tableOfContents",
  "pageBreak",
  "fieldCanvas",
  "contentBlockEmbed",
];

/**
 * Per-block name, design, and lock flags used by the element gear menu.
 */
export const BlockMeta = Extension.create({
  name: "blockMeta",

  addGlobalAttributes() {
    return [
      {
        types: BLOCK_TYPES,
        attributes: {
          blockName: {
            default: "",
            parseHTML: (element) => element.getAttribute("data-block-name") ?? "",
            renderHTML: (attributes) =>
              attributes.blockName ? { "data-block-name": String(attributes.blockName) } : {},
          },
          blockDesign: {
            default: "default",
            parseHTML: (element) => element.getAttribute("data-block-design") ?? "default",
            renderHTML: (attributes) =>
              attributes.blockDesign && attributes.blockDesign !== "default"
                ? { "data-block-design": String(attributes.blockDesign) }
                : {},
          },
          locked: {
            default: false,
            parseHTML: (element) => element.getAttribute("data-block-locked") === "true",
            renderHTML: (attributes) =>
              attributes.locked
                ? { "data-block-locked": "true", contenteditable: "false" }
                : {},
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleTextInput(view, from, to) {
            let locked = false;
            view.state.doc.nodesBetween(from, to, (node) => {
              if (node.attrs.locked === true) {
                locked = true;
              }
            });
            return locked;
          },
        },
      }),
    ];
  },
});
