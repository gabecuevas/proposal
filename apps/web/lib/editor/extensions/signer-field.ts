import { mergeAttributes, Node } from "@tiptap/core";

export const SignerField = Node.create({
  name: "signerField",
  group: "block",
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      fieldId: { default: "" },
      recipientId: { default: "" },
      type: { default: "signature" },
      required: { default: true },
      label: { default: "" },
      placeholder: { default: "" },
      defaultValue: { default: "" },
      dropdownOptions: { default: "[]" },
      xPct: { default: 0.04 },
      yPct: { default: 0.04 },
      wPct: { default: 0.38 },
      hPct: { default: 0.09 },
      page: { default: 0 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-node-type="signerField"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-node-type": "signerField",
        "data-signer-field-id": String(HTMLAttributes.fieldId ?? ""),
        class: "signer-field-node",
      }),
    ];
  },
});
