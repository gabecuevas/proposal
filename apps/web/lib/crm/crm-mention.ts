import { Node, mergeAttributes } from "@tiptap/core";

export type CrmMentionAttrs = {
  userId: string;
  label: string;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    crmMention: {
      insertCrmMention: (attrs: CrmMentionAttrs) => ReturnType;
    };
  }
}

export const CrmMention = Node.create({
  name: "crmMention",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      userId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-user-id"),
        renderHTML: (attributes) =>
          attributes.userId ? { "data-user-id": attributes.userId } : {},
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-label") ?? element.textContent?.replace(/^@/, ""),
        renderHTML: (attributes) =>
          attributes.label ? { "data-label": attributes.label } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-crm-mention]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const label = String(node.attrs.label ?? "");
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-crm-mention": "",
        class: "crm-mention rounded bg-primary/10 px-1 font-medium text-primary",
        contenteditable: "false",
      }),
      `@${label}`,
    ];
  },

  addCommands() {
    return {
      insertCrmMention:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs,
            })
            .insertContent(" ")
            .run(),
    };
  },
});
