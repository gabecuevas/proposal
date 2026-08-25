import { Node } from "@tiptap/core";

export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  draggable: true,

  parseHTML() {
    return [{ tag: "div[data-page-break]" }];
  },

  renderHTML() {
    return ["div", { "data-page-break": "true", "data-node-type": "pageBreak", class: "page-break" }];
  },
});
