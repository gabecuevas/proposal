import type { EditorDoc } from "@/lib/editor/types";

function textFromNode(node: unknown): string {
  if (!node || typeof node !== "object") {
    return "";
  }
  const n = node as { type?: string; text?: string; content?: unknown[] };
  if (n.type === "text" && typeof n.text === "string") {
    return n.text;
  }
  if (Array.isArray(n.content)) {
    return n.content.map(textFromNode).join(" ").trim();
  }
  return "";
}

/** First meaningful line from TipTap JSON for list/table display */
export function documentTitleFromEditorJson(doc: EditorDoc | null | undefined, fallbackId: string): string {
  if (!doc?.content?.length) {
    return `Document ${fallbackId.slice(0, 8)}…`;
  }
  for (const block of doc.content) {
    const t = textFromNode(block).trim();
    if (t.length > 0) {
      return t.length > 72 ? `${t.slice(0, 69)}…` : t;
    }
  }
  return `Document ${fallbackId.slice(0, 8)}…`;
}
