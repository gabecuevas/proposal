import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin } from "@tiptap/pm/state";

const PINNED = new Set(["fieldOverlay"]);

/** Empty top-level paragraphs are not elements — they steal the + insert gap. */
export function isScaffoldFlowNode(node: { type: { name: string }; content: { size: number } }): boolean {
  return node.type.name === "paragraph" && node.content.size === 0;
}

function flowChildCount(doc: ProseMirrorNode): number {
  let count = 0;
  doc.forEach((node) => {
    if (!PINNED.has(node.type.name) && !isScaffoldFlowNode(node)) {
      count += 1;
    }
  });
  return count;
}

function findScaffoldDeletions(doc: ProseMirrorNode): { from: number; to: number }[] {
  if (flowChildCount(doc) === 0) {
    return [];
  }
  const deletions: { from: number; to: number }[] = [];
  doc.forEach((node, offset) => {
    if (PINNED.has(node.type.name)) {
      return;
    }
    if (isScaffoldFlowNode(node)) {
      deletions.push({ from: offset, to: offset + node.nodeSize });
    }
  });
  return deletions;
}

/**
 * Empty space between elements is an insert gap (the + control), not a new
 * text element. Enter inside a text box still adds a line in that box.
 */
export const FlowGaps = Extension.create({
  name: "flowGaps",

  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { selection, doc } = this.editor.state;
        const { $from } = selection;
        if ($from.depth !== 1 || $from.parent.type.name !== "paragraph" || $from.parent.content.size > 0) {
          return false;
        }
        if (this.editor.isActive("textBox")) {
          return false;
        }

        const index = $from.index(0);
        const prev = index > 0 ? doc.child(index - 1) : null;
        const emptyFrom = $from.before(1);
        const emptyTo = emptyFrom + $from.parent.nodeSize;

        if (prev?.type.name === "textBox") {
          const insideEnd = emptyFrom - 1;
          return this.editor
            .chain()
            .deleteRange({ from: emptyFrom, to: emptyTo })
            .setTextSelection(insideEnd)
            .splitBlock()
            .run();
        }

        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) {
            return null;
          }
          if (transactions.some((tr) => tr.getMeta("flowGaps") === "skip")) {
            return null;
          }
          const deletions = findScaffoldDeletions(newState.doc);
          if (deletions.length === 0) {
            return null;
          }
          const tr = newState.tr.setMeta("flowGaps", "skip").setMeta("addToHistory", false);
          for (let i = deletions.length - 1; i >= 0; i -= 1) {
            const range = deletions[i];
            if (range) {
              tr.delete(range.from, range.to);
            }
          }
          return tr;
        },
        props: {
          handleClick(view, pos) {
            const $pos = view.state.doc.resolve(pos);
            for (let depth = $pos.depth; depth > 0; depth -= 1) {
              if ($pos.node(depth).type.name === "fieldOverlay") {
                return true;
              }
            }
            if ($pos.depth === 1 && isScaffoldFlowNode($pos.parent)) {
              return true;
            }
            const top = $pos.depth === 0 ? $pos.nodeAfter ?? $pos.nodeBefore : $pos.node(1);
            return Boolean(top && isScaffoldFlowNode(top));
          },
        },
        view(editorView) {
          const strip = () => {
            const deletions = findScaffoldDeletions(editorView.state.doc);
            if (deletions.length === 0) {
              return;
            }
            const tr = editorView.state.tr.setMeta("flowGaps", "skip").setMeta("addToHistory", false);
            for (let i = deletions.length - 1; i >= 0; i -= 1) {
              const range = deletions[i];
              if (range) {
                tr.delete(range.from, range.to);
              }
            }
            editorView.dispatch(tr);
          };
          strip();
          return {};
        },
      }),
    ];
  },
});
