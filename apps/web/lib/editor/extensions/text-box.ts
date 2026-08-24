import { mergeAttributes, Node } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textBox: {
      insertTextBox: () => ReturnType;
    };
  }
}

/**
 * A bordered content block so "add a text box" is a real element, not just
 * another paragraph in the flow. Drag handles move the whole box.
 */
export const TextBox = Node.create({
  name: "textBox",
  group: "block",
  content: "paragraph+",
  defining: true,
  draggable: true,

  parseHTML() {
    return [{ tag: 'div[data-node-type="textBox"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-node-type": "textBox",
        class: "creator-text-box",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertTextBox:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            content: [{ type: "paragraph" }],
          }),
    };
  },
});
