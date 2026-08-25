import type { Editor } from "@tiptap/core";

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

export function insertImageAsset(editor: Editor, asset: UploadedAsset): void {
  editor
    .chain()
    .focus()
    .insertContent({
      type: "image",
      attrs: {
        src: asset.url,
        assetKey: asset.key,
        alt: asset.name,
        widthPct: 100,
        align: "center",
      },
    })
    .run();
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

export function insertVideo(editor: Editor, rawUrl: string): boolean {
  const src = normalizeVideoUrl(rawUrl);
  if (!src) {
    return false;
  }
  return editor.chain().focus().setYoutubeVideo({ src, width: 640, height: 360 }).run();
}

export function insertTable(editor: Editor, rows = 3, cols = 3): void {
  editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
}

export function insertTextBlock(editor: Editor): void {
  editor.chain().focus().insertTextBox().run();
}

export function insertHeading(editor: Editor, level: 1 | 2 | 3): void {
  editor.chain().focus().insertContent({ type: "heading", attrs: { level } }).run();
}

export function insertDivider(editor: Editor): void {
  editor.chain().focus().setHorizontalRule().run();
}

export function insertPageBreak(editor: Editor): void {
  editor.chain().focus().insertContent({ type: "pageBreak" }).run();
}

export function insertTableOfContents(editor: Editor): void {
  editor.chain().focus().insertTableOfContents().run();
}

export function insertQuoteTable(editor: Editor, tableId = "default"): void {
  editor.chain().focus().insertContent({ type: "quoteTable", attrs: { tableId } }).run();
}

export function insertVariable(editor: Editor, key: string): void {
  const trimmed = key.trim();
  if (!trimmed) {
    return;
  }
  editor.chain().focus().insertContent({ type: "variableToken", attrs: { key: trimmed } }).run();
}
