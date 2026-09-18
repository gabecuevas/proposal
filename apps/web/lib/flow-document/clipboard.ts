import type { Editor } from "@tiptap/core";
import { DOMSerializer } from "@tiptap/pm/model";
import { sanitizeFlowPastedHtml } from "@/lib/flow-document/paste";

/**
 * HTML-aware clipboard for Flow Edit menu + keyboard fallbacks.
 * Keyboard paste while the editor is focused still uses TipTap's
 * `transformPastedHTML` path; this covers menu actions and unfocused shortcuts.
 */
export async function runFlowClipboard(
  editor: Editor | null | undefined,
  action: "cut" | "copy" | "paste",
): Promise<boolean> {
  if (!editor) {
    return false;
  }
  editor.chain().focus().run();
  const { from, to, empty } = editor.state.selection;

  if (action === "copy" || action === "cut") {
    if (empty) {
      return false;
    }
    const text = editor.state.doc.textBetween(from, to, "\n");
    const slice = editor.state.selection.content();
    const serializer = DOMSerializer.fromSchema(editor.schema);
    const container = document.createElement("div");
    container.appendChild(serializer.serializeFragment(slice.content));
    const html = container.innerHTML;
    try {
      if (typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "text/html": new Blob([html], { type: "text/html" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      return document.execCommand(action);
    }
    if (action === "cut") {
      return editor.chain().focus().deleteSelection().run();
    }
    return true;
  }

  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes("text/html")) {
        const blob = await item.getType("text/html");
        const html = await blob.text();
        const clean = sanitizeFlowPastedHtml(html);
        return editor.chain().focus().insertContent(clean).run();
      }
    }
    const text = await navigator.clipboard.readText();
    if (!text) {
      return false;
    }
    return editor.chain().focus().insertContent(text).run();
  } catch {
    return document.execCommand("paste");
  }
}
