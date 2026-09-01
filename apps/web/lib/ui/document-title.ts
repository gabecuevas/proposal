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

function titleFromAttrs(doc: EditorDoc | null | undefined): string {
  const value = doc?.attrs?.title;
  return typeof value === "string" ? value.trim() : "";
}

function clipTitle(value: string): string {
  return value.length > 72 ? `${value.slice(0, 69)}…` : value;
}

/**
 * Prefer an explicit Save-as / header title when one is stored on the doc.
 * Otherwise use the first non-empty line of content.
 */
export function documentTitleFromEditorJson(doc: EditorDoc | null | undefined, fallbackId?: string): string {
  const named = titleFromAttrs(doc);
  if (named) {
    return clipTitle(named);
  }
  if (doc?.content?.length) {
    for (const block of doc.content) {
      const t = textFromNode(block).trim();
      if (t.length > 0) {
        return clipTitle(t);
      }
    }
  }
  if (fallbackId?.trim()) {
    return clipTitle(`Document ${fallbackId.trim().slice(0, 8)}`);
  }
  return "Untitled document";
}

/** Persist the gallery/header title without changing body content. */
export function applyTitleToDoc(doc: EditorDoc, title: string): EditorDoc {
  const next = structuredClone(doc);
  const trimmed = title.trim();
  next.attrs = { ...next.attrs };
  if (trimmed) {
    next.attrs.title = trimmed;
  } else {
    delete next.attrs.title;
  }
  return next;
}
