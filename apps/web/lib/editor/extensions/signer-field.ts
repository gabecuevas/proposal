import { Node } from "@tiptap/core";

export const SignerField = Node.create({
  name: "signerField",
  inline: true,
  atom: true,
  group: "inline",
  selectable: true,

  addAttributes() {
    return {
      fieldId: { default: "" },
      recipientId: { default: "" },
      type: { default: "signature" },
      required: { default: true },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-signer-field-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const type = String(HTMLAttributes.type ?? "signature");
    return [
      "span",
      {
        ...HTMLAttributes,
        "data-signer-field-id": HTMLAttributes.fieldId,
        class: "signer-field rounded border border-primary/40 bg-surface px-2 py-1 text-xs text-primary",
      },
      `Signer ${type}`,
    ];
  },
});
