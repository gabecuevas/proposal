import { mergeAttributes, Node } from "@tiptap/core";
import { Plugin } from "@tiptap/pm/state";

function isFieldFormControl(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest("input, textarea, select, button, [data-field-settings], [data-assign-pill]"),
  );
}

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
      multiline: { default: false },
      validation: { default: "none" },
      mergeField: { default: "" },
      maskValue: { default: false },
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

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            mousedown(_view, event) {
              return isFieldFormControl(event.target);
            },
            pointerdown(_view, event) {
              return isFieldFormControl(event.target);
            },
          },
        },
      }),
    ];
  },
});
