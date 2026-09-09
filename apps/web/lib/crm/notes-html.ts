export const NOTE_SIZE_LIMIT_BYTES = 100 * 1024;

export function noteSizeBytes(html: string): number {
  return new TextEncoder().encode(html ?? "").length;
}

export function noteSizePercent(html: string): number {
  const bytes = noteSizeBytes(html);
  return Math.min(100, Math.round((bytes / NOTE_SIZE_LIMIT_BYTES) * 100));
}

export function isNoteOverLimit(html: string): boolean {
  return noteSizeBytes(html) > NOTE_SIZE_LIMIT_BYTES;
}

export function isEmptyNoteHtml(html: string): boolean {
  if (!html) {
    return true;
  }
  const text = html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .trim();
  return text.length === 0;
}

export function normalizeNoteHtml(html: string): string {
  return isEmptyNoteHtml(html) ? "" : html;
}

/** Strip unsafe tags/attrs for display; force links to open in a new tab. */
export function sanitizeNoteHtmlForDisplay(html: string): string {
  if (!html || isEmptyNoteHtml(html)) {
    return "";
  }
  if (typeof DOMParser === "undefined") {
    return html;
  }
  const parsed = new DOMParser().parseFromString(html, "text/html");
  parsed.querySelectorAll("script,style,iframe,object,embed,form").forEach((el) => el.remove());
  parsed.querySelectorAll("*").forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || value.startsWith("javascript:")) {
        el.removeAttribute(attr.name);
      }
    }
  });
  parsed.querySelectorAll("a[href]").forEach((anchor) => {
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  });
  return parsed.body.innerHTML;
}
