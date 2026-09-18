/**
 * Flow / Docs paste helpers: keep tables + column widths while stripping
 * dangerous layout that breaks the editor.
 */
import {
  clampPasteLineHeight,
  isPastePageFooterText,
  normalizeFontSize,
  sanitizePastedHtml,
} from "@/lib/editor/paste";

/** Styles safe on any pasted node. */
const FLOW_KEEP_STYLE_PROPS = new Set([
  "font-weight",
  "font-style",
  "font-family",
  "font-size",
  "text-decoration",
  "text-decoration-line",
  "text-align",
  "color",
  "background-color",
  "line-height",
]);

/** Extra styles TipTap tables need for Docs-like column layout. */
const FLOW_TABLE_KEEP_STYLE_PROPS = new Set([
  ...FLOW_KEEP_STYLE_PROPS,
  "width",
  "min-width",
  "max-width",
  "height",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "vertical-align",
  "border",
  "border-width",
  "border-style",
  "border-color",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-collapse",
  "background",
  "background-color",
]);

const FLOW_STRIP_ALWAYS = new Set([
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
  "display",
  "flex",
  "flex-direction",
  "grid",
  "gap",
  "overflow",
  "white-space",
  "letter-spacing",
  "word-spacing",
  "box-shadow",
  "text-indent",
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
  return [...map.entries()].map(([prop, value]) => `${prop}: ${value}`).join("; ");
}

/**
 * Google Docs clipboard HTML ships column widths in a <style> block + class names.
 * Resolve those onto inline styles before we strip classes.
 */
export function inlineGoogleDocsClassStyles(root: ParentNode, styleText: string): void {
  if (!styleText.trim()) {
    return;
  }
  const rules = new Map<string, Map<string, string>>();
  const ruleRe = /\.([a-zA-Z0-9_-]+)\s*\{([^}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = ruleRe.exec(styleText))) {
    const className = match[1];
    const body = match[2] ?? "";
    if (!className) {
      continue;
    }
    rules.set(className, parseCssDeclarations(body));
  }
  if (rules.size === 0) {
    return;
  }

  const elements = "querySelectorAll" in root ? root.querySelectorAll("[class]") : [];
  for (const el of elements) {
    const classNames = (el.getAttribute("class") ?? "").split(/\s+/).filter(Boolean);
    if (classNames.length === 0) {
      continue;
    }
    const merged = parseCssDeclarations(el.getAttribute("style") ?? "");
    for (const name of classNames) {
      const decls = rules.get(name);
      if (!decls) {
        continue;
      }
      for (const [prop, value] of decls) {
        if (!merged.has(prop)) {
          merged.set(prop, value);
        }
      }
    }
    if (merged.size > 0) {
      el.setAttribute("style", serializeCss(merged));
    }
  }
}

function isTableLayoutTag(tag: string): boolean {
  return tag === "table" || tag === "td" || tag === "th" || tag === "col" || tag === "tr" || tag === "thead" || tag === "tbody" || tag === "tfoot";
}

function normalizeFlowWidth(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) {
    return null;
  }
  // Keep % and pt/px widths for columns; clamp absurd px to page-ish max.
  if (value.endsWith("%")) {
    const n = Number(value.slice(0, -1));
    if (!Number.isFinite(n) || n <= 0) {
      return null;
    }
    return `${Math.min(100, Math.max(1, Math.round(n * 100) / 100))}%`;
  }
  const match = value.match(/^(-?\d+(?:\.\d+)?)(px|pt|in|cm|mm)?$/i);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  const unit = (match[2] ?? "px").toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  let px = amount;
  if (unit === "pt") {
    px = amount * (96 / 72);
  } else if (unit === "in") {
    px = amount * 96;
  } else if (unit === "cm") {
    px = amount * (96 / 2.54);
  } else if (unit === "mm") {
    px = amount * (96 / 25.4);
  }
  // Content width of Letter @ 1" margins ≈ 624px; allow a little headroom.
  const clamped = Math.min(720, Math.max(24, Math.round(px)));
  return `${clamped}px`;
}

function widthToPx(raw: string | null | undefined): number {
  if (!raw) {
    return 0;
  }
  const normalized = normalizeFlowWidth(raw);
  if (!normalized) {
    return 0;
  }
  if (normalized.endsWith("%")) {
    return 0;
  }
  if (normalized.endsWith("px")) {
    return Number(normalized.slice(0, -2)) || 0;
  }
  return 0;
}

/**
 * Convert absolute column widths to percentages of the row so inline-block
 * cells fit the page instead of wrapping to a second line.
 */
export function normalizeTableWidthsToPercents(root: ParentNode): void {
  const tables = "querySelectorAll" in root ? root.querySelectorAll("table") : [];
  tables.forEach((table) => {
    const firstRow = table.querySelector("tr");
    if (!firstRow) {
      return;
    }
    const headCells = [...firstRow.querySelectorAll(":scope > td, :scope > th")] as HTMLElement[];
    if (headCells.length === 0) {
      return;
    }
    const widths = headCells.map((cell) => {
      const decls = parseCssDeclarations(cell.getAttribute("style") ?? "");
      const fromStyle = widthToPx(decls.get("width"));
      if (fromStyle > 0) {
        return fromStyle;
      }
      return widthToPx(cell.getAttribute("width"));
    });
    const total = widths.reduce((a, b) => a + b, 0);
    if (total <= 0) {
      return;
    }
    const percents = widths.map((w) => Math.max(8, Math.round((w / total) * 10000) / 100));
    // Fix rounding so percentages sum to 100.
    const sum = percents.reduce((a, b) => a + b, 0);
    if (percents.length > 0 && Math.abs(sum - 100) > 0.01) {
      percents[percents.length - 1] = Math.round((percents[percents.length - 1] + (100 - sum)) * 100) / 100;
    }

    table.querySelectorAll("tr").forEach((row) => {
      const cells = [...row.querySelectorAll(":scope > td, :scope > th")] as HTMLElement[];
      cells.forEach((cell, index) => {
        const pct = percents[Math.min(index, percents.length - 1)] ?? 50;
        const decls = parseCssDeclarations(cell.getAttribute("style") ?? "");
        decls.set("width", `${pct}%`);
        cell.setAttribute("style", serializeCss(decls));
        cell.removeAttribute("width");
      });
    });
  });
}

function normalizeFlowInlineStyle(style: string, tableLayout: boolean): string | null {
  const decls = parseCssDeclarations(style);
  const next = new Map<string, string>();
  const allow = tableLayout ? FLOW_TABLE_KEEP_STYLE_PROPS : FLOW_KEEP_STYLE_PROPS;

  for (const [prop, value] of decls) {
    if (FLOW_STRIP_ALWAYS.has(prop)) {
      continue;
    }
    if (!allow.has(prop) && !(tableLayout && prop.startsWith("border"))) {
      continue;
    }
    if (prop === "font-size") {
      const size = normalizeFontSize(value);
      if (size) {
        next.set(prop, size);
      }
      continue;
    }
    if (prop === "line-height") {
      const lh = clampPasteLineHeight(value);
      if (lh) {
        next.set(prop, lh);
      }
      continue;
    }
    if (prop === "width" || prop === "min-width" || prop === "max-width") {
      if (!tableLayout) {
        continue;
      }
      const width = normalizeFlowWidth(value);
      if (width) {
        next.set(prop, width);
      }
      continue;
    }
    if (prop === "height" && tableLayout) {
      // Ignore fixed row heights from Docs — they fight wrapping.
      continue;
    }
    next.set(prop, value);
  }

  if (next.size === 0) {
    return null;
  }
  return serializeCss(next);
}

function normalizeFlowElement(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    const name = attr.name.toLowerCase();
    const value = attr.value.trim().toLowerCase();
    if (name.startsWith("on") || value.startsWith("javascript:")) {
      el.removeAttribute(attr.name);
    }
  }

  const tag = el.tagName.toLowerCase();
  const tableLayout = isTableLayoutTag(tag);

  if (el.hasAttribute("class")) {
    el.removeAttribute("class");
  }
  if (el.hasAttribute("id")) {
    el.removeAttribute("id");
  }

  if (el.hasAttribute("data-line-height")) {
    const clamped = clampPasteLineHeight(el.getAttribute("data-line-height") ?? "");
    if (clamped) {
      el.setAttribute("data-line-height", clamped);
    } else {
      el.removeAttribute("data-line-height");
    }
  }

  // Promote width/height HTML attrs onto style for table cells before sanitize.
  if (tableLayout && el.hasAttribute("width")) {
    const width = normalizeFlowWidth(el.getAttribute("width") ?? "");
    if (width) {
      const decls = parseCssDeclarations(el.getAttribute("style") ?? "");
      if (!decls.has("width")) {
        decls.set("width", width);
        el.setAttribute("style", serializeCss(decls));
      }
    }
  }

  if (el.hasAttribute("style")) {
    const normalized = normalizeFlowInlineStyle(el.getAttribute("style") ?? "", tableLayout);
    if (normalized) {
      el.setAttribute("style", normalized);
    } else {
      el.removeAttribute("style");
    }
  }

  if (tag === "p" && isPastePageFooterText(el.textContent ?? "")) {
    el.remove();
    return;
  }

  if (tag === "table" || tag === "td" || tag === "th" || tag === "col") {
    // Keep width via style; drop presentational attrs TipTap ignores inconsistently.
    el.removeAttribute("height");
    el.removeAttribute("align");
    // Preserve width attribute only if style width missing (TipTap colwidth path).
    if (!el.getAttribute("style")?.includes("width") && el.hasAttribute("width")) {
      const width = normalizeFlowWidth(el.getAttribute("width") ?? "");
      if (width) {
        el.setAttribute("style", `width: ${width}`);
      }
    }
    el.removeAttribute("width");
  }

  if (tag === "img") {
    el.removeAttribute("width");
    el.removeAttribute("height");
    const src = el.getAttribute("src") ?? "";
    if (!src || src.startsWith("javascript:")) {
      el.remove();
      return;
    }
    const title = (el.getAttribute("title") ?? "").toLowerCase();
    const alt = (el.getAttribute("alt") ?? "").toLowerCase();
    if (title.includes("horizontal line") || alt.includes("horizontal line")) {
      const hr = el.ownerDocument.createElement("hr");
      el.replaceWith(hr);
      return;
    }
    el.setAttribute("style", "max-width: 100%; height: auto;");
  }

  if (tag === "span" && !el.attributes.length && el.childNodes.length === 0) {
    el.remove();
  }
}

/**
 * Flow paste pipeline: keep tables/column widths from Google Docs, strip the rest.
 * Does NOT flatten tables — Flow keeps PaginationPlus on; table rows use float-compatible layout.
 */
export function sanitizeFlowPastedHtml(html: string): string {
  if (!html) {
    return "";
  }
  if (typeof DOMParser === "undefined") {
    return sanitizePastedHtml(html);
  }

  const parsed = new DOMParser().parseFromString(html, "text/html");
  const styleText = [...parsed.querySelectorAll("style")].map((node) => node.textContent ?? "").join("\n");
  inlineGoogleDocsClassStyles(parsed.body, styleText);

  parsed.body.querySelectorAll("script,style,iframe,object,embed,link,meta,form").forEach((el) => el.remove());
  const elements = [...parsed.body.querySelectorAll("*")].reverse();
  for (const el of elements) {
    normalizeFlowElement(el);
  }
  normalizeTableWidthsToPercents(parsed.body);
  return parsed.body.innerHTML;
}

export { sanitizePastedHtml };
