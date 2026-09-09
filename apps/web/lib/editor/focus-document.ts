import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";

const SKIP_FOCUS_PARENTS = new Set(["fieldOverlay", "signerField"]);

/**
 * Place the caret at the first typeable textblock — Google Docs blank-sheet
 * behavior after open / create. Skips overlay-only containers so PDF-backed
 * docs land in flow content when present.
 */
export function focusDocumentStart(editor: Editor): boolean {
  if (editor.isDestroyed) {
    return false;
  }

  let target: number | null = null;
  editor.state.doc.descendants((node, pos, parent) => {
    if (target != null) {
      return false;
    }
    if (parent && SKIP_FOCUS_PARENTS.has(parent.type.name)) {
      return false;
    }
    if (node.type.name === "fieldOverlay" || node.type.name === "signerField") {
      return false;
    }
    if (node.isTextblock) {
      target = pos + 1;
      return false;
    }
    return true;
  });

  if (target == null) {
    try {
      editor.commands.focus("start", { scrollIntoView: false });
      return true;
    } catch {
      return false;
    }
  }

  try {
    const selection = TextSelection.create(editor.state.doc, target);
    editor.view.dispatch(editor.state.tr.setSelection(selection));
    editor.view.focus();
    return true;
  } catch {
    return editor.commands.focus("start", { scrollIntoView: false });
  }
}

/** Focus after the next paint so NodeViews / page chrome are mounted. */
export function scheduleFocusDocumentStart(editor: Editor): void {
  if (editor.isDestroyed) {
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (!editor.isDestroyed) {
        focusDocumentStart(editor);
      }
    });
  });
}
