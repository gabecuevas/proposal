import type { JSONContent } from "@tiptap/core";

/** Stable stringify for Flow Document prototype JSON (in-memory / fixture only). */
export function serializeFlowDoc(doc: JSONContent): string {
  return JSON.stringify(doc);
}

export function parseFlowDoc(raw: string): JSONContent {
  const parsed = JSON.parse(raw) as JSONContent;
  if (!parsed || typeof parsed !== "object" || parsed.type !== "doc") {
    throw new Error("Invalid Flow Document JSON: expected type doc");
  }
  return parsed;
}

/** Count explicit pageBreak nodes in the JSON tree. */
export function countExplicitPageBreaks(node: JSONContent): number {
  let count = node.type === "pageBreak" ? 1 : 0;
  for (const child of node.content ?? []) {
    count += countExplicitPageBreaks(child);
  }
  return count;
}

/** Rough text extraction for round-trip checks (not WYSIWYG). */
export function extractFlowPlainText(node: JSONContent): string {
  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }
  return (node.content ?? []).map(extractFlowPlainText).join(" ");
}
