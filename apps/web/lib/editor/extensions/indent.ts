import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { INDENT_MAX } from "../commands/format-presets";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indent: {
      increaseIndent: () => ReturnType;
      decreaseIndent: () => ReturnType;
    };
  }
}

function nextIndent(current: unknown, delta: number): number {
  const value = Number(current ?? 0);
  const indent = Number.isFinite(value) ? value : 0;
  return Math.min(INDENT_MAX, Math.max(0, indent + delta));
}

const TEXT_BLOCKS = new Set(["paragraph", "heading"]);

/** Apply attributes to paragraph/heading nodes in the selection (including inside a text box). */
export function mapTextBlocks(
  state: EditorState,
  tr: Transaction,
  dispatch: ((tr: Transaction) => void) | undefined,
  mapAttrs: (node: ProseMirrorNode) => Record<string, unknown>,
): boolean {
  const positions = new Map<number, ProseMirrorNode>();
  const { $from, from, to, empty } = state.selection;

  if (empty) {
    for (let depth = $from.depth; depth > 0; depth -= 1) {
      const node = $from.node(depth);
      if (TEXT_BLOCKS.has(node.type.name)) {
        positions.set($from.before(depth), node);
        break;
      }
    }
  }

  if (positions.size === 0) {
    const end = empty ? Math.min(state.doc.content.size, from + 1) : to;
    state.doc.nodesBetween(from, end, (node, pos) => {
      if (TEXT_BLOCKS.has(node.type.name)) {
        positions.set(pos, node);
        return false;
      }
      return true;
    });
  }

  if (positions.size === 0) {
    return false;
  }
  if (dispatch) {
    for (const [pos, node] of positions) {
      tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...mapAttrs(node) });
    }
    dispatch(tr);
  }
  return true;
}

export const Indent = Extension.create({
  name: "indent",

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: 0,
            parseHTML: (element) => {
              const raw = element.getAttribute("data-indent");
              const value = raw ? Number(raw) : 0;
              return Number.isFinite(value) ? Math.min(INDENT_MAX, Math.max(0, value)) : 0;
            },
            renderHTML: (attributes) =>
              attributes.indent
                ? { "data-indent": String(attributes.indent) }
                : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      increaseIndent:
        () =>
        ({ state, tr, dispatch }) =>
          mapTextBlocks(state, tr, dispatch, (node) => ({
            indent: nextIndent(node.attrs.indent, 1),
          })),
      decreaseIndent:
        () =>
        ({ state, tr, dispatch }) =>
          mapTextBlocks(state, tr, dispatch, (node) => ({
            indent: nextIndent(node.attrs.indent, -1),
          })),
    };
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive("listItem")) {
          return false;
        }
        return this.editor.commands.increaseIndent();
      },
      "Shift-Tab": () => {
        if (this.editor.isActive("listItem")) {
          return false;
        }
        return this.editor.commands.decreaseIndent();
      },
    };
  },
});
