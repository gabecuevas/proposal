import { Node } from "@tiptap/core";

export const QuoteTable = Node.create({
  name: "quoteTable",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      tableId: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: "section[data-quote-table-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "section",
      {
        ...HTMLAttributes,
        "data-quote-table-id": HTMLAttributes.tableId,
        class: "quote-table rounded border border-border bg-surface p-4",
      },
      "Quote table",
    ];
  },
});
