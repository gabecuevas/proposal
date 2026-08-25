import type { EditorOptions } from "@tiptap/core";
import { sanitizePastedHtml } from "./paste";

export const creatorEditorProps: EditorOptions["editorProps"] = {
  attributes: {
    class: "tiptap-creator min-h-full max-w-none focus:outline-none",
  },
  transformPastedHTML: sanitizePastedHtml,
};
