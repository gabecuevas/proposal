import { Node } from "@tiptap/core";

export const VariableToken = Node.create({
  name: "variableToken",
  inline: true,
  atom: true,
  group: "inline",
  selectable: true,

  addAttributes() {
    return {
      key: { default: "" },
      fallback: { default: null },
      format: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-variable-key]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const key = String(HTMLAttributes.key ?? "");
    return [
      "span",
      {
        ...HTMLAttributes,
        "data-variable-key": key,
        class: "variable-token rounded bg-surface px-2 py-1 text-xs text-primary",
      },
      `{{${key}}}`,
    ];
  },
});
