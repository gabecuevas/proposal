import type { EditorOptions } from "@tiptap/core";
import { FIELD_DRAG_MIME, FIELD_DROP_EVENT } from "./field-drag";
import { sanitizePastedHtml } from "./paste";

function isFieldDrag(event: DragEvent): boolean {
  return Boolean(event.dataTransfer?.types.includes(FIELD_DRAG_MIME));
}

export const creatorEditorProps: EditorOptions["editorProps"] = {
  attributes: {
    class: "tiptap-creator min-h-full max-w-none focus:outline-none",
  },
  transformPastedHTML: sanitizePastedHtml,
  handleDOMEvents: {
    // Text Blocks / ProseMirror are the drop target; allow the tray drag here so
    // fillable fields can land on top of body copy without splitting it.
    dragover(_view, event) {
      if (!isFieldDrag(event)) {
        return false;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
      return true;
    },
    drop(_view, event) {
      if (!isFieldDrag(event) || !event.dataTransfer) {
        return false;
      }
      const type = event.dataTransfer.getData(FIELD_DRAG_MIME);
      if (!type) {
        return false;
      }
      event.preventDefault();
      event.stopPropagation();
      window.dispatchEvent(
        new CustomEvent(FIELD_DROP_EVENT, {
          detail: { type, clientX: event.clientX, clientY: event.clientY },
        }),
      );
      return true;
    },
  },
};
