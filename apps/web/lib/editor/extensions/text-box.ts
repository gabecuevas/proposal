import { mergeAttributes, Node } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { NodeSelection, Plugin, TextSelection } from "@tiptap/pm/state";
import type { EditorView, NodeView } from "@tiptap/pm/view";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { TextBoxView } from "@/components/editor/overlay-text-box-view";
import { overlayTextBoxSelectionPlugin } from "../overlay-text-box";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    textBox: {
      insertTextBox: () => ReturnType;
    };
  }
}

function enterTextBoxIfNodeSelected(view: EditorView): boolean {
  const { selection } = view.state;
  if (!(selection instanceof NodeSelection) || selection.node.type.name !== "textBox") {
    return false;
  }
  const inside = Math.min(selection.from + 1, selection.to - 1);
  view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(inside))));
  return true;
}

/**
 * Flow Text Blocks must use a plain contentDOM so PageFlow can inject
 * `creator-flow-break` widgets between paragraphs. React NodeViews swallow
 * those widgets and text paints through the page gutter.
 */
function createFlowTextBoxNodeView(node: ProseMirrorNode): NodeView {
  const dom = document.createElement("div");
  dom.className = "creator-text-box";
  dom.setAttribute("data-node-type", "textBox");
  if (node.attrs.blockName) {
    dom.setAttribute("data-block-name", String(node.attrs.blockName));
  }
  return {
    dom,
    contentDOM: dom,
    update(updated) {
      if (updated.type.name !== "textBox") {
        return false;
      }
      // Overlay boxes need the React chrome — remount as Adjustable Text Box.
      if (String(updated.attrs.boxId ?? "")) {
        return false;
      }
      return true;
    },
  };
}

/**
 * Full-width Text Block (flow) or Adjustable Text Box (overlay via boxId).
 * Isolating so multi-paragraph write-ups stay one library-savable element.
 */
export const TextBox = Node.create({
  name: "textBox",
  group: "block",
  content: "(paragraph | heading | bulletList | orderedList)+",
  isolating: true,
  draggable: false,

  addAttributes() {
    return {
      /** Set when the box is an overlay on a PDF canvas or field overlay. */
      boxId: { default: "" },
      xPct: { default: 0.08 },
      yPct: { default: 0.08 },
      wPct: { default: 0.42 },
      hPct: { default: 0.08 },
      page: { default: 0 },
      zIndex: { default: 1 },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-node-type="textBox"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const overlay = Boolean(HTMLAttributes.boxId);
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-node-type": "textBox",
        class: overlay ? "overlay-text-box" : "creator-text-box",
        ...(overlay
          ? {
              "data-overlay-text-box-id": String(HTMLAttributes.boxId ?? ""),
            }
          : {}),
      }),
      0,
    ];
  },

  addNodeView() {
    const overlayView = ReactNodeViewRenderer(TextBoxView, {
      className: "text-box-renderer",
    });
    return (props) => {
      if (String(props.node.attrs.boxId ?? "")) {
        return overlayView(props);
      }
      return createFlowTextBoxNodeView(props.node);
    };
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

  addProseMirrorPlugins() {
    return [
      overlayTextBoxSelectionPlugin(),
      new Plugin({
        props: {
          handlePaste(view, _event, slice) {
            const { selection } = view.state;
            if (!(selection instanceof NodeSelection) || selection.node.type.name !== "textBox") {
              return false;
            }
            const inside = Math.min(selection.from + 1, selection.to - 1);
            let tr = view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(inside)));
            tr = tr.replaceSelection(slice);
            view.dispatch(tr.scrollIntoView());
            return true;
          },
          handleTextInput(view, _from, _to, text) {
            if (!enterTextBoxIfNodeSelected(view)) {
              return false;
            }
            const { from } = view.state.selection;
            view.dispatch(view.state.tr.insertText(text, from));
            return true;
          },
        },
      }),
    ];
  },
});
