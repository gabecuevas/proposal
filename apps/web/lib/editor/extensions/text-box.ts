import { mergeAttributes, Node } from "@tiptap/core";
import { NodeSelection } from "@tiptap/pm/state";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textBox: {
      insertTextBox: () => ReturnType;
    };
  }
}

/**
 * A bordered content block so "add a text box" is a real element, not just
 * another paragraph in the flow. Drag handles move the whole box. Enter creates
 * a new paragraph *inside* this box so a long write-up stays one element even
 * when it flows onto the next page.
 */
export const TextBox = Node.create({
  name: "textBox",
  group: "block",
  content: "(paragraph | heading | bulletList | orderedList)+",
  isolating: true,
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

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        if (!this.editor.isActive(this.name)) {
          return false;
        }
        const { selection } = this.editor.state;
        if (selection instanceof NodeSelection && selection.node.type.name === this.name) {
          return this.editor.commands.setTextSelection(selection.from + 1);
        }
        if (this.editor.commands.splitBlock()) {
          return true;
        }
        return this.editor.commands.insertContent({ type: "paragraph" });
      },
      "Shift-Enter": () => this.editor.commands.setHardBreak(),
    };
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
