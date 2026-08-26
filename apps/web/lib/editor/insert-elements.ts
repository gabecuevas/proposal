import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { requestPageFlowSync } from "./extensions/page-flow";

export type UploadedAsset = { key: string; url: string; name: string; contentType: string };

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function isSupportedImage(file: File): boolean {
  return IMAGE_TYPES.has(file.type);
}

export async function uploadAsset(file: File): Promise<UploadedAsset> {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/uploads", { method: "POST", body });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? "Upload failed");
  }
  const payload = (await response.json()) as { upload: UploadedAsset };
  return payload.upload;
}

export function insertImageAsset(editor: Editor, asset: UploadedAsset, at?: number): void {
  const node = {
    type: "image",
    attrs: {
      src: asset.url,
      assetKey: asset.key,
      alt: asset.name,
      widthPct: 100,
      align: "center",
    },
  };
  if (at != null) {
    insertContentAtTopLevel(editor, at, node);
    return;
  }
  editor.chain().focus().insertContent(node).run();
  requestPageFlowSync(editor);
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** Accepts the forms you get from the YouTube share button and the address bar. */
export function normalizeVideoUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(url.hostname)) {
    return null;
  }

  if (url.hostname.endsWith("youtu.be")) {
    const id = url.pathname.replace(/^\//, "").split("/")[0];
    return id ? `https://www.youtube.com/watch?v=${id}` : null;
  }
  if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
    const id = url.pathname.split("/")[2];
    return id ? `https://www.youtube.com/watch?v=${id}` : null;
  }
  const id = url.searchParams.get("v");
  return id ? `https://www.youtube.com/watch?v=${id}` : null;
}

/** Map a document position onto a top-level slot so inserts never land inside
 *  an isolating block such as a text box. */
export function topLevelInsertPos(editor: Editor, pos: number): number {
  const size = editor.state.doc.content.size;
  const clamped = Math.max(0, Math.min(pos, size));
  const $pos = editor.state.doc.resolve(clamped);
  if ($pos.depth === 0) {
    return clamped;
  }
  return $pos.before(1);
}

export function insertContentAtTopLevel(editor: Editor, pos: number, content: object | object[]): boolean {
  const insertPos = topLevelInsertPos(editor, pos);
  const items = Array.isArray(content) ? content : [content];
  try {
    const nodes = items.map((item) => editor.schema.nodeFromJSON(item));
    const ok = editor
      .chain()
      .focus()
      .command(({ tr, dispatch }) => {
        if (!dispatch) {
          return true;
        }
        let at = insertPos;
        for (const node of nodes) {
          tr.insert(at, node);
          at += node.nodeSize;
        }
        tr.setSelection(TextSelection.near(tr.doc.resolve(Math.min(insertPos + 1, tr.doc.content.size))));
        return true;
      })
      .run();
    if (ok) {
      requestPageFlowSync(editor);
    }
    return ok;
  } catch {
    const ok = editor.chain().focus().insertContentAt(insertPos, content).run();
    if (ok) {
      requestPageFlowSync(editor);
    }
    return ok;
  }
}

function emptyParagraph() {
  return { type: "paragraph" };
}

function tableNode(rows: number, cols: number) {
  const safeRows = Math.max(1, rows);
  const safeCols = Math.max(1, cols);
  const header = {
    type: "tableRow",
    content: Array.from({ length: safeCols }, () => ({ type: "tableHeader", content: [emptyParagraph()] })),
  };
  const body = Array.from({ length: Math.max(0, safeRows - 1) }, () => ({
    type: "tableRow",
    content: Array.from({ length: safeCols }, () => ({ type: "tableCell", content: [emptyParagraph()] })),
  }));
  return { type: "table", content: [header, ...body] };
}

export function insertVideo(editor: Editor, rawUrl: string, at?: number): boolean {
  const src = normalizeVideoUrl(rawUrl);
  if (!src) {
    return false;
  }
  if (at != null) {
    return insertContentAtTopLevel(editor, at, { type: "youtube", attrs: { src } });
  }
  const ok = editor.chain().focus().setYoutubeVideo({ src, width: 640, height: 360 }).run();
  if (ok) {
    requestPageFlowSync(editor);
  }
  return ok;
}

export function insertTable(editor: Editor, rows = 3, cols = 3, at?: number): void {
  if (at != null) {
    insertContentAtTopLevel(editor, at, tableNode(rows, cols));
    return;
  }
  editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
  requestPageFlowSync(editor);
}

export function insertTextBlock(editor: Editor, at?: number): void {
  const node = { type: "textBox", content: [emptyParagraph()] };
  if (at != null) {
    insertContentAtTopLevel(editor, at, node);
    return;
  }
  editor.chain().focus().insertTextBox().run();
  requestPageFlowSync(editor);
}

export function insertHeading(editor: Editor, level: 1 | 2 | 3, at?: number): void {
  const node = { type: "heading", attrs: { level }, content: [] };
  if (at != null) {
    insertContentAtTopLevel(editor, at, node);
    return;
  }
  editor.chain().focus().insertContent(node).run();
}

export function insertBulletList(editor: Editor, at?: number): void {
  if (at != null) {
    insertContentAtTopLevel(editor, at, {
      type: "bulletList",
      content: [{ type: "listItem", content: [emptyParagraph()] }],
    });
    return;
  }
  editor.chain().focus().toggleBulletList().run();
}

export function insertOrderedList(editor: Editor, at?: number): void {
  if (at != null) {
    insertContentAtTopLevel(editor, at, {
      type: "orderedList",
      content: [{ type: "listItem", content: [emptyParagraph()] }],
    });
    return;
  }
  editor.chain().focus().toggleOrderedList().run();
}

export function insertQuote(editor: Editor, at?: number): void {
  if (at != null) {
    insertContentAtTopLevel(editor, at, { type: "blockquote", content: [emptyParagraph()] });
    return;
  }
  editor.chain().focus().toggleBlockquote().run();
}

export function insertDivider(editor: Editor, at?: number): void {
  if (at != null) {
    insertContentAtTopLevel(editor, at, { type: "horizontalRule" });
    return;
  }
  editor.chain().focus().setHorizontalRule().run();
}

export function insertPageBreak(editor: Editor, at?: number): void {
  const node = { type: "pageBreak" };
  if (at != null) {
    insertContentAtTopLevel(editor, at, node);
    return;
  }
  editor.chain().focus().insertContent(node).run();
}

export function insertTableOfContents(editor: Editor, at?: number): void {
  if (at != null) {
    insertContentAtTopLevel(editor, at, { type: "tableOfContents" });
    return;
  }
  editor.chain().focus().insertTableOfContents().run();
}

export function insertQuoteTable(editor: Editor, tableId = "default", at?: number): void {
  const node = { type: "quoteTable", attrs: { tableId } };
  if (at != null) {
    insertContentAtTopLevel(editor, at, node);
    return;
  }
  editor.chain().focus().insertContent(node).run();
  requestPageFlowSync(editor);
}

export function insertVariable(editor: Editor, key: string, at?: number): void {
  const trimmed = key.trim();
  if (!trimmed) {
    return;
  }
  const node = { type: "variableToken", attrs: { key: trimmed } };
  if (at != null) {
    insertContentAtTopLevel(editor, at, node);
    return;
  }
  editor.chain().focus().insertContent(node).run();
}
