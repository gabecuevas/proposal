import type { Editor } from "@tiptap/core";

export const EMPTY_TEXT_PLACEHOLDER = "Enter text...";

export function storedFieldText(placeholder: string): string {
  return placeholder === "" || placeholder === EMPTY_TEXT_PLACEHOLDER ? "" : placeholder;
}

/** Persist canvas-typed text onto the field node even if selection has already moved. */
export function commitSignerFieldPlaceholder(editor: Editor, pos: number, value: string): boolean {
  const next = value.trim() === "" ? EMPTY_TEXT_PLACEHOLDER : value;
  const current = editor.state.doc.nodeAt(pos);
  if (!current || current.type.name !== "signerField") {
    return false;
  }
  if (current.attrs.placeholder === next) {
    return true;
  }
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(pos, undefined, {
      ...current.attrs,
      placeholder: next,
    }),
  );
  return true;
}
