const BLOCKED_TAGS = /<(script|style|iframe|object|embed|link|meta|form)(\s[^>]*)?>[\s\S]*?<\/\1>/gi;
const BLOCKED_EMPTY_TAGS = /<(script|style|iframe|object|embed|link|meta|form)(\s[^>]*)?\/?>/gi;
const EVENT_ATTRS = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL = /javascript:/gi;

/** Layout props that fight page-flow measurement when pasted from Docs/Word. */
const STRIP_STYLE_PROPS = new Set([
  "position",
  "top",
  "left",
  "right",
  "bottom",
  "float",
  "clear",
  "z-index",
  "transform",
  "translate",
  "width",
  "height",
  "max-width",
  "min-width",
  "max-height",
  "min-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "display",
  "flex",
  "flex-direction",
  "grid",
  "gap",
  "overflow",
  "white-space",
  "letter-spacing",
  "word-spacing",
  "vertical-align",
  "box-shadow",
  "text-indent",
  "border",
  "border-width",
  "border-style",
  "border-color",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "background",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
]);

/** Marks TipTap already understands — keep these so paste stays rich. */
const KEEP_STYLE_PROPS = new Set([
  "font-weight",
  "font-style",
  "font-family",
  "text-decoration",
  "text-decoration-line",
  "text-align",
  "color",
  "background-color",
  "line-height",
]);

/** Word/PDF signature blocks often paste line-height 3+ and slice across seams. */
const MAX_PASTE_LINE_HEIGHT = 2;

/**
 * Pasted docs embed prior pagination as body text ("Page 1 of 3"). Those
 * markers fight our live page gaps and look like overlapping chrome.
 */
export function isPastePageFooterText(text: string): boolean {
  const normalized = text.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return false;
  }
  if (/^page\s+\d+\s+of\s+\d+$/i.test(normalized)) {
    return true;
  }
  if (
    normalized.length <= 160 &&
    /copyright/i.test(normalized) &&
    /page\s+\d+\s+of\s+\d+$/i.test(normalized)
  ) {
    return true;
  }
  return false;
}

export function clampPasteLineHeight(raw: string): string | null {
  const lh = raw.trim();
  if (!lh || lh === "normal") {
    return lh === "normal" ? "normal" : null;
  }
  if (/^(1\.2|1\.5|1\.6|2)$/.test(lh)) {
    return lh;
  }
  if (/^\d+(\.\d+)?$/.test(lh)) {
    const n = Number(lh);
    if (!Number.isFinite(n) || n <= 0) {
      return null;
    }
    return String(Math.min(MAX_PASTE_LINE_HEIGHT, Math.round(n * 1000) / 1000));
  }
  return null;
}

const ALLOWED_FONT_SIZES = new Set([
  "10px",
  "11px",
  "12px",
  "13px",
  "14px",
  "15px",
  "16px",
  "18px",
  "20px",
  "24px",
  "28px",
  "32px",
  "36px",
  "48px",
]);

function parseCssDeclarations(style: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const part of style.split(";")) {
    const colon = part.indexOf(":");
    if (colon < 0) {
      continue;
    }
    const prop = part.slice(0, colon).trim().toLowerCase();
    const value = part.slice(colon + 1).trim();
    if (prop && value) {
      map.set(prop, value);
    }
  }
  return map;
}

function serializeCss(map: Map<string, string>): string {
  return [...map.entries()]
    .map(([prop, value]) => `${prop}: ${value}`)
    .join("; ");
}

/** Convert common Docs/Word size units into a clamped px size TipTap accepts. */
export function normalizeFontSize(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value || value === "inherit" || value === "initial" || value === "medium") {
    return null;
  }
  const match = value.match(/^(-?\d+(?:\.\d+)?)(px|pt|em|rem|%)$/i);
  if (!match) {
    return ALLOWED_FONT_SIZES.has(value) ? value : null;
  }
  const amount = Number(match[1]);
  const unit = (match[2] ?? "px").toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  let px = amount;
  if (unit === "pt") {
    px = amount * (96 / 72);
  } else if (unit === "em" || unit === "rem") {
    px = amount * 15;
  } else if (unit === "%") {
    px = (amount / 100) * 15;
  }
  const clamped = Math.min(48, Math.max(10, Math.round(px)));
  const asPx = `${clamped}px`;
  return ALLOWED_FONT_SIZES.has(asPx) ? asPx : `${clamped}px`;
}

function normalizeInlineStyle(style: string): string | null {
  const decls = parseCssDeclarations(style);
  const next = new Map<string, string>();

  for (const [prop, value] of decls) {
    if (STRIP_STYLE_PROPS.has(prop)) {
      continue;
    }
    if (prop === "font-size") {
      const size = normalizeFontSize(value);
      if (size) {
        next.set("font-size", size);
      }
      continue;
    }
    if (prop === "line-height") {
      const lh = clampPasteLineHeight(value);
      if (lh) {
        next.set("line-height", lh);
      }
      continue;
    }
    if (KEEP_STYLE_PROPS.has(prop)) {
      next.set(prop, value);
    }
  }

  if (next.size === 0) {
    return null;
  }
  return serializeCss(next);
}

function stripUnsafeAttributes(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    const value = attr.value.trim().toLowerCase();
    if (name.startsWith("on") || value.startsWith("javascript:")) {
      el.removeAttribute(attr.name);
    }
  }
}

function normalizeElement(el: Element): void {
  stripUnsafeAttributes(el);

  // Google Docs / Word dump class noise that can collide with our CSS.
  if (el.hasAttribute("class")) {
    el.removeAttribute("class");
  }
  if (el.hasAttribute("id")) {
    el.removeAttribute("id");
  }

  const tag = el.tagName.toLowerCase();

  if (el.hasAttribute("data-line-height")) {
    const clamped = clampPasteLineHeight(el.getAttribute("data-line-height") ?? "");
    if (clamped) {
      el.setAttribute("data-line-height", clamped);
    } else {
      el.removeAttribute("data-line-height");
    }
  }

  if (el.hasAttribute("style")) {
    const normalized = normalizeInlineStyle(el.getAttribute("style") ?? "");
    if (normalized) {
      el.setAttribute("style", normalized);
    } else {
      el.removeAttribute("style");
    }
  }

  // Drop Word/PDF page-number paragraphs so they are not mistaken for our chrome.
  if (tag === "p" && isPastePageFooterText(el.textContent ?? "")) {
    el.remove();
    return;
  }

  // Absolute sizes on tables/images blow page packing.
  if (tag === "table" || tag === "td" || tag === "th" || tag === "col") {
    el.removeAttribute("width");
    el.removeAttribute("height");
    el.removeAttribute("align");
  }
  if (tag === "img") {
    el.removeAttribute("width");
    el.removeAttribute("height");
    const src = el.getAttribute("src") ?? "";
    if (!src || src.startsWith("javascript:")) {
      el.remove();
      return;
    }
    // Let our image node view size to the page; keep aspect via CSS.
    el.setAttribute("style", "max-width: 100%; height: auto;");
  }

  // Empty spans from Docs leave no-op wrappers that fragment lines.
  if (tag === "span" && !el.attributes.length && el.childNodes.length === 0) {
    el.remove();
  }
}

function normalizePastedDocument(root: ParentNode): void {
  root.querySelectorAll("script,style,iframe,object,embed,link,meta,form").forEach((el) => el.remove());
  // Walk deepest-first so removing empty spans does not skip siblings.
  const elements = [...root.querySelectorAll("*")].reverse();
  for (const el of elements) {
    normalizeElement(el);
  }
}

function sanitizeWithRegex(html: string): string {
  return html.replace(BLOCKED_TAGS, "").replace(BLOCKED_EMPTY_TAGS, "").replace(EVENT_ATTRS, "").replace(JS_URL, "");
}

/**
 * Strip executable markup and normalize layout styles from external paste
 * (Google Docs, Word, browsers). TipTap maps the remainder onto the schema;
 * this pass keeps pagination from inheriting absolute widths, floats, and
 * exotic font sizes that throw off PageFlow measurement.
 */
export function sanitizePastedHtml(html: string): string {
  if (!html) {
    return "";
  }
  if (typeof DOMParser === "undefined") {
    return sanitizeWithRegex(html);
  }
  const parsed = new DOMParser().parseFromString(html, "text/html");
  normalizePastedDocument(parsed.body);
  return parsed.body.innerHTML;
}
