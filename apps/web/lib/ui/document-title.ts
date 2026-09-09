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

function attrString(doc: EditorDoc | null | undefined, key: string): string {
  const value = doc?.attrs?.[key];
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
  const named = attrString(doc, "title");
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

export function documentDueDateFromEditorJson(doc: EditorDoc | null | undefined): string {
  return attrString(doc, "due_date");
}

export function documentSenderFromEditorJson(doc: EditorDoc | null | undefined): string {
  return attrString(doc, "sender_name");
}

/** Persist gallery/header metadata without changing body content. */
export function applyDocumentMetaToDoc(
  doc: EditorDoc,
  meta: {
    title?: string;
    dueDate?: string | null;
    senderName?: string | null;
    senderUserId?: string | null;
  },
): EditorDoc {
  const next = structuredClone(doc);
  next.attrs = { ...next.attrs };

  if (meta.title !== undefined) {
    const trimmed = meta.title.trim();
    if (trimmed) {
      next.attrs.title = trimmed;
    } else {
      delete next.attrs.title;
    }
  }

  if (meta.dueDate !== undefined) {
    const trimmed = meta.dueDate?.trim() ?? "";
    if (trimmed) {
      next.attrs.due_date = trimmed;
    } else {
      delete next.attrs.due_date;
    }
  }

  if (meta.senderName !== undefined) {
    const trimmed = meta.senderName?.trim() ?? "";
    if (trimmed) {
      next.attrs.sender_name = trimmed;
    } else {
      delete next.attrs.sender_name;
    }
  }

  if (meta.senderUserId !== undefined) {
    const trimmed = meta.senderUserId?.trim() ?? "";
    if (trimmed) {
      next.attrs.sender_user_id = trimmed;
    } else {
      delete next.attrs.sender_user_id;
    }
  }

  return next;
}

/** Persist the gallery/header title without changing body content. */
export function applyTitleToDoc(doc: EditorDoc, title: string): EditorDoc {
  return applyDocumentMetaToDoc(doc, { title });
}
