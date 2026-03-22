import { Node } from "@tiptap/core";

export const ContentBlockEmbed = Node.create({
  name: "contentBlockEmbed",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      blockId: { default: "" },
      version: { default: 1 },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-content-block-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      {
        ...HTMLAttributes,
        "data-content-block-id": HTMLAttributes.blockId,
        "data-content-block-version": String(HTMLAttributes.version ?? 1),
        class: "content-block-embed rounded border border-border bg-surface p-3 text-sm text-muted",
      },
      `Embedded block: ${HTMLAttributes.blockId ?? "unknown"}`,
    ];
  },
});
