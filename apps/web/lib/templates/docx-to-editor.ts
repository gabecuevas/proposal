import type { EditorDoc, EditorNode, JSONValue } from "@/lib/editor/types";
import mammoth from "mammoth";
import { Buffer } from "node:buffer";

type Mark = { type: string; attrs?: Record<string, JSONValue> };

type InlineState = {
  bold: number;
  italic: number;
  underline: number;
  strike: number;
  linkHref: string | null;
};

export const MAMMOTH_STYLE_MAP = [
  // Keep titles as paragraphs so import doesn't inflate heading spacing.
  "p[style-name='Title'] => p.doc-title:fresh",
  "p[style-name='title'] => p.doc-title:fresh",
  "p[style-name='Subtitle'] => p.doc-subtitle:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "r[style-name='Strong'] => strong",
  "p[style-name='Quote'] => blockquote > p:fresh",
  "p[style-name='Intense Quote'] => blockquote > p:fresh",
];

/** Invisible layout markers prepended by mammoth transformDocument. */
const LAYOUT_MARK_RE = /^«sd:(c|r|j|i[1-8])»/;

function twipsToIndentLevel(twips: number): number {
  if (!Number.isFinite(twips) || twips <= 0) return 0;
  // ~360 twips ≈ 0.25" — typical Word indent step for (a)/(b) clauses.
  return Math.min(8, Math.max(1, Math.round(twips / 360)));
}

function makeLayoutMarkerRun(markers: string[]): Record<string, unknown> {
  return {
    type: "run",
    children: [{ type: "text", value: markers.join("") }],
    styleId: null,
    styleName: null,
    isBold: false,
    isUnderline: false,
    isItalic: false,
    isStrikethrough: false,
    isAllCaps: false,
    isSmallCaps: false,
    verticalAlignment: "baseline",
    font: null,
    fontSize: null,
    highlight: null,
  };
}

/**
 * Encode Word alignment/indent into text markers so HTML conversion preserves them.
 * Mammoth does not emit padding-left / text-align by default.
 */
export function transformDocxParagraph(paragraph: {
  type?: string;
  alignment?: string | null;
  indent?: { start?: string | number | null };
  children?: unknown[];
  [key: string]: unknown;
}) {
  if (paragraph.type !== "paragraph") return paragraph;
  const markers: string[] = [];
  const alignment = String(paragraph.alignment ?? "").toLowerCase();
  if (alignment === "center") markers.push("«sd:c»");
  else if (alignment === "right") markers.push("«sd:r»");
  else if (alignment === "both" || alignment === "justify") markers.push("«sd:j»");

  const indentLevel = twipsToIndentLevel(Number(paragraph.indent?.start ?? 0));
  if (indentLevel > 0) markers.push(`«sd:i${indentLevel}»`);
  if (markers.length === 0) return paragraph;

  return {
    ...paragraph,
    children: [makeLayoutMarkerRun(markers), ...(paragraph.children ?? [])],
  };
}

function consumeLayoutMarkers(text: string): {
  text: string;
  align: "left" | "center" | "right" | "justify" | null;
  indent: number;
} {
  let rest = text;
  let align: "left" | "center" | "right" | "justify" | null = null;
  let indent = 0;
  while (LAYOUT_MARK_RE.test(rest)) {
    const match = rest.match(LAYOUT_MARK_RE);
    if (!match) break;
    const code = match[1]!;
    if (code === "c") align = "center";
    else if (code === "r") align = "right";
    else if (code === "j") align = "justify";
    else if (code.startsWith("i")) indent = Number(code.slice(1));
    rest = rest.slice(match[0].length);
  }
  return { text: rest, align, indent };
}

function fillBlankNode(charCount: number, extraMarks: Mark[] = []): EditorNode {
  const count = Math.max(6, Math.min(72, charCount));
  const marks: Mark[] = [{ type: "fillBlank" }, ...extraMarks.filter((m) => m.type !== "underline")];
  return {
    type: "text",
    text: "\u00a0".repeat(count),
    marks,
  };
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, "\u00a0")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function marksFromState(state: InlineState): Mark[] | undefined {
  const marks: Mark[] = [];
  if (state.bold > 0) marks.push({ type: "bold" });
  if (state.italic > 0) marks.push({ type: "italic" });
  if (state.underline > 0) marks.push({ type: "underline" });
  if (state.strike > 0) marks.push({ type: "strike" });
  if (state.linkHref) {
    marks.push({ type: "link", attrs: { href: state.linkHref, target: "_blank" } });
  }
  return marks.length > 0 ? marks : undefined;
}

function makeText(text: string, state: InlineState): EditorNode | null {
  if (!text) return null;
  const marks = marksFromState(state);
  return marks ? { type: "text", text, marks } : { type: "text", text };
}

function parseStyleAlign(style: string | undefined): "left" | "center" | "right" | "justify" | null {
  if (!style) return null;
  const match = style.match(/text-align\s*:\s*(left|center|right|justify)/i);
  const value = match?.[1]?.toLowerCase();
  if (value === "left" || value === "center" || value === "right" || value === "justify") {
    return value;
  }
  return null;
}

function getAttr(attrs: string, name: string): string | undefined {
  const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return match?.[2] ?? match?.[3] ?? match?.[4];
}

function hasClass(attrs: string, className: string): boolean {
  const classes = (getAttr(attrs, "class") ?? "").split(/\s+/);
  return classes.includes(className);
}

function isSignatureLineText(text: string): boolean {
  const trimmed = text.replace(/\u00a0/g, " ").trim();
  return /^[_\u2013\u2014\-]{4,}$/.test(trimmed);
}

/** Solid fill/signature line that can live inside a Text Block (HR cannot). */
function signatureFillParagraph(
  align: "left" | "center" | "right" | "justify" | null = null,
): EditorNode {
  return paragraphNode([fillBlankNode(40)], align);
}

function plainTextOf(nodes: EditorNode[]): string {
  return nodes
    .map((n) => {
      if (n.type === "text") return n.text ?? "";
      if (n.type === "hardBreak") return "\n";
      return "";
    })
    .join("");
}

function paragraphNode(
  content: EditorNode[],
  align: "left" | "center" | "right" | "justify" | null,
  indent = 0,
): EditorNode {
  const attrs: Record<string, JSONValue> = {};
  if (align) attrs.textAlign = align;
  if (indent > 0) attrs.indent = indent;
  return {
    type: "paragraph",
    attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
    content: content.length > 0 ? content : undefined,
  };
}

function parseIndentFromStyle(style: string | undefined): number {
  if (!style) return 0;
  const match = style.match(/(?:padding|margin)-left\s*:\s*([\d.]+)\s*(px|pt|em|rem)?/i);
  if (!match) return 0;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value <= 0) return 0;
  const unit = (match[2] ?? "px").toLowerCase();
  const px = unit === "pt" ? value * (96 / 72) : unit === "em" || unit === "rem" ? value * 16 : value;
  return Math.min(8, Math.max(0, Math.round(px / 20)));
}

const TEXT_BOX_CHILD_TYPES = new Set(["paragraph", "heading", "bulletList", "orderedList"]);

function applyItalicToInline(nodes: EditorNode[]): EditorNode[] {
  return nodes.map((node) => {
    if (node.type !== "text") return node;
    const marks = [...(node.marks ?? [])];
    if (!marks.some((m) => m.type === "italic")) {
      marks.push({ type: "italic" });
    }
    return { ...node, marks };
  });
}

/**
 * Normalize blocks that cannot nest in a TipTap Text Block, then pack consecutive
 * body copy into a single continuous textBox (PandaDoc-style import).
 * Tables and other structural siblings stay outside the text block.
 */
export function packContinuousTextBlock(blocks: EditorNode[]): EditorNode[] {
  const normalized: EditorNode[] = [];

  for (const block of blocks) {
    if (block.type === "horizontalRule") {
      normalized.push(signatureFillParagraph());
      continue;
    }
    if (block.type === "blockquote") {
      for (const child of block.content ?? []) {
        if (child.type === "paragraph" || child.type === "heading") {
          normalized.push({
            ...child,
            content: applyItalicToInline(child.content ?? []),
          });
        } else if (TEXT_BOX_CHILD_TYPES.has(child.type)) {
          normalized.push(child);
        } else {
          normalized.push(child);
        }
      }
      continue;
    }
    normalized.push(block);
  }

  const laidOut = applyImportLayoutHeuristics(normalized);

  const result: EditorNode[] = [];
  let run: EditorNode[] = [];

  const flushRun = () => {
    if (run.length === 0) return;
    result.push({
      type: "textBox",
      attrs: { boxId: "" },
      content: run,
    });
    run = [];
  };

  for (const block of laidOut) {
    if (TEXT_BOX_CHILD_TYPES.has(block.type)) {
      run.push(block);
      continue;
    }
    flushRun();
    result.push(block);
  }
  flushRun();

  if (result.length === 0) {
    return [
      {
        type: "textBox",
        attrs: { boxId: "" },
        content: [{ type: "paragraph" }],
      },
    ];
  }
  return result;
}

function blockPlainText(node: EditorNode): string {
  if (node.type === "text") return node.text ?? "";
  return (node.content ?? []).map(blockPlainText).join("");
}

function looksLikeTitle(text: string): boolean {
  const t = text.replace(/\u00a0/g, " ").trim();
  if (!t || t.length > 110) return false;
  if (/agreement|independent contractor|statement of work|exhibit\s+[a-z]/i.test(t) && t.length < 90) {
    return true;
  }
  const letters = t.replace(/[^A-Za-z]/g, "");
  return letters.length >= 10 && letters === letters.toUpperCase();
}

function looksLikeClauseIndent(text: string): boolean {
  return /^\(([a-z]|[ivxlcdm]+|\d+)\)\s/i.test(text.replace(/\u00a0/g, " ").trim());
}

/** Center titles and indent lettered clauses when Word styles were missing. */
export function applyImportLayoutHeuristics(blocks: EditorNode[]): EditorNode[] {
  let titleSlots = 0;
  return blocks.map((block, index) => {
    if (block.type !== "paragraph" && block.type !== "heading") return block;
    const text = blockPlainText(block).replace(/\u00a0/g, " ").trim();
    const attrs = { ...(block.attrs ?? {}) };

    if (
      titleSlots < 2 &&
      index < 4 &&
      !attrs.textAlign &&
      looksLikeTitle(text)
    ) {
      attrs.textAlign = "center";
      titleSlots += 1;
    }

    if ((!attrs.indent || Number(attrs.indent) === 0) && looksLikeClauseIndent(text)) {
      attrs.indent = 1;
    }

    return { ...block, attrs: Object.keys(attrs).length ? attrs : undefined };
  });
}

/**
 * Convert mammoth/Word HTML into TipTap JSON.
 * Preserves bold/italic/underline, alignment, lists, and solid signature lines.
 * Never leaves raw HTML tags in text nodes.
 */
export function htmlToEditorContent(html: string): EditorNode[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");

  const blocks: EditorNode[] = [];
  let inline: EditorNode[] = [];
  let state: InlineState = { bold: 0, italic: 0, underline: 0, strike: 0, linkHref: null };
  let pendingAlign: "left" | "center" | "right" | "justify" | null = null;
  let pendingIndent = 0;
  let pendingSubtitle = false;
  let openHeading: number | null = null;
  let inBlockquote = false;
  let listType: "bulletList" | "orderedList" | null = null;
  let listItems: EditorNode[] = [];
  let listItemParas: EditorNode[] = [];
  let inListItem = false;
  const spanStyleStack: Array<{ bold: boolean; italic: boolean; underline: boolean }> = [];

  function pushInline(text: string) {
    const layout = consumeLayoutMarkers(text);
    if (layout.align && !pendingAlign) pendingAlign = layout.align;
    if (layout.indent > 0 && pendingIndent === 0) pendingIndent = layout.indent;
    const source = layout.text;

    // Solid fill blanks — underscore glyphs + underline look dashed.
    const parts = source.split(/([_\u2013\u2014\-]{4,})/);
    for (const part of parts) {
      if (!part) continue;
      if (/^[_\u2013\u2014\-]{4,}$/.test(part)) {
        const extras = marksFromState(state)?.filter((m) => m.type !== "underline") ?? [];
        inline.push(fillBlankNode(part.length, extras));
        continue;
      }
      const node = makeText(part, state);
      if (node) inline.push(node);
    }
  }

  function emitBlock(node: EditorNode) {
    if (inListItem) {
      listItemParas.push(node);
      return;
    }
    blocks.push(node);
  }

  function flushInlineAsParagraph() {
    if (openHeading !== null) {
      const level = Math.min(3, Math.max(1, openHeading));
      const content = inBlockquote ? applyItalicToInline(inline) : inline;
      emitBlock({
        type: "heading",
        attrs: {
          level,
          ...(pendingAlign ? { textAlign: pendingAlign } : {}),
          ...(pendingIndent > 0 ? { indent: pendingIndent } : {}),
        },
        content: content.length > 0 ? content : undefined,
      });
      inline = [];
      pendingAlign = null;
      pendingIndent = 0;
      pendingSubtitle = false;
      openHeading = null;
      return;
    }

    const text = plainTextOf(inline).replace(/\u00a0/g, " ").trim();
    if (isSignatureLineText(text)) {
      emitBlock(signatureFillParagraph(pendingAlign));
      inline = [];
      pendingAlign = null;
      pendingIndent = 0;
      pendingSubtitle = false;
      return;
    }

    if (inline.length === 0) {
      pendingAlign = null;
      pendingIndent = 0;
      pendingSubtitle = false;
      return;
    }

    let content = inBlockquote ? applyItalicToInline(inline) : inline;
    if (pendingSubtitle) content = applyItalicToInline(content);
    emitBlock(paragraphNode(content, pendingAlign, pendingIndent));
    inline = [];
    pendingAlign = null;
    pendingIndent = 0;
    pendingSubtitle = false;
  }

  function closeListItem() {
    if (!inListItem) return;
    if (inline.length > 0) flushInlineAsParagraph();
    listItems.push({
      type: "listItem",
      content: listItemParas.length > 0 ? listItemParas : [{ type: "paragraph" }],
    });
    listItemParas = [];
    inListItem = false;
  }

  function closeList() {
    closeListItem();
    if (listType && listItems.length > 0) {
      blocks.push({ type: listType, content: listItems });
    }
    listType = null;
    listItems = [];
  }

  const tokenRe = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>|([^<]+)/g;
  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(cleaned)) !== null) {
    const rawTag = match[1];
    const rawAttrs = match[2] ?? "";
    const rawText = match[3];

    if (rawText !== undefined) {
      const decoded = decodeEntities(rawText);
      // Collapse runs of whitespace but keep single spaces so "a <b>b</b>" stays readable.
      const text = decoded.replace(/[ \t\f\v]+/g, " ").replace(/\r?\n/g, " ");
      if (text.length > 0) pushInline(text);
      continue;
    }

    const tag = (rawTag ?? "").toLowerCase();
    const open = !match[0].startsWith("</");
    const selfClosing = /\/>$/.test(match[0]) || tag === "br" || tag === "hr" || tag === "img";

    if (tag === "br") {
      inline.push({ type: "hardBreak" });
      continue;
    }
    if (tag === "hr") {
      flushInlineAsParagraph();
      emitBlock(signatureFillParagraph());
      continue;
    }
    if (tag === "img") continue;

    if (open && !selfClosing) {
      if (tag === "strong" || tag === "b") state = { ...state, bold: state.bold + 1 };
      else if (tag === "em" || tag === "i") state = { ...state, italic: state.italic + 1 };
      else if (tag === "u") state = { ...state, underline: state.underline + 1 };
      else if (tag === "s" || tag === "strike" || tag === "del") {
        state = { ...state, strike: state.strike + 1 };
      } else if (tag === "a") {
        const href = getAttr(rawAttrs, "href");
        if (href && !/^javascript:/i.test(href)) state = { ...state, linkHref: href };
      } else if (tag === "span") {
        const style = getAttr(rawAttrs, "style") ?? "";
        const bold = /font-weight\s*:\s*(bold|[6-9]00)/i.test(style);
        const italic = /font-style\s*:\s*italic/i.test(style);
        const underline = /text-decoration[^;]*underline/i.test(style);
        spanStyleStack.push({ bold, italic, underline });
        if (bold) state = { ...state, bold: state.bold + 1 };
        if (italic) state = { ...state, italic: state.italic + 1 };
        if (underline) state = { ...state, underline: state.underline + 1 };
      } else if (tag === "ul") {
        flushInlineAsParagraph();
        closeList();
        listType = "bulletList";
      } else if (tag === "ol") {
        flushInlineAsParagraph();
        closeList();
        listType = "orderedList";
      } else if (tag === "li") {
        flushInlineAsParagraph();
        closeListItem();
        inListItem = true;
        listItemParas = [];
      } else if (/^h[1-6]$/.test(tag)) {
        flushInlineAsParagraph();
        openHeading = Number(tag.slice(1));
        const style = getAttr(rawAttrs, "style");
        pendingAlign =
          parseStyleAlign(style) ?? (hasClass(rawAttrs, "doc-title") ? "center" : null);
        pendingIndent = parseIndentFromStyle(style);
      } else if (tag === "blockquote") {
        flushInlineAsParagraph();
        inBlockquote = true;
      } else if (tag === "p" || tag === "div") {
        flushInlineAsParagraph();
        const style = getAttr(rawAttrs, "style");
        const titleClass = hasClass(rawAttrs, "doc-title") || hasClass(rawAttrs, "doc-subtitle");
        pendingAlign = parseStyleAlign(style) ?? (titleClass ? "center" : null);
        pendingIndent = parseIndentFromStyle(style);
        pendingSubtitle = hasClass(rawAttrs, "doc-subtitle");
      } else if (tag === "td" || tag === "th") {
        if (inline.length > 0) pushInline(" ");
      }
      continue;
    }

    if (!open) {
      if (tag === "strong" || tag === "b") {
        state = { ...state, bold: Math.max(0, state.bold - 1) };
      } else if (tag === "em" || tag === "i") {
        state = { ...state, italic: Math.max(0, state.italic - 1) };
      } else if (tag === "u") {
        state = { ...state, underline: Math.max(0, state.underline - 1) };
      } else if (tag === "s" || tag === "strike" || tag === "del") {
        state = { ...state, strike: Math.max(0, state.strike - 1) };
      } else if (tag === "a") {
        state = { ...state, linkHref: null };
      } else if (tag === "span") {
        const applied = spanStyleStack.pop();
        if (applied?.bold) state = { ...state, bold: Math.max(0, state.bold - 1) };
        if (applied?.italic) state = { ...state, italic: Math.max(0, state.italic - 1) };
        if (applied?.underline) {
          state = { ...state, underline: Math.max(0, state.underline - 1) };
        }
      } else if (tag === "li") {
        closeListItem();
      } else if (tag === "ul" || tag === "ol") {
        closeList();
      } else if (/^h[1-6]$/.test(tag)) {
        flushInlineAsParagraph();
      } else if (tag === "blockquote") {
        flushInlineAsParagraph();
        inBlockquote = false;
      } else if (tag === "p" || tag === "div" || tag === "pre") {
        flushInlineAsParagraph();
      } else if (tag === "tr") {
        flushInlineAsParagraph();
      } else if (tag === "td" || tag === "th") {
        pushInline(" ");
      }
      // Any other closing tag: ignore (do not dump into text).
    }
  }

  flushInlineAsParagraph();
  closeList();
  return blocks.length > 0 ? blocks : [{ type: "paragraph" }];
}

const mammothOptions = {
  styleMap: MAMMOTH_STYLE_MAP,
  includeDefaultStyleMap: true,
  ignoreEmptyParagraphs: false,
  // mammoth exposes `transforms` at runtime; the published typings omit it.
  transformDocument: (
    mammoth as typeof mammoth & {
      transforms: {
        paragraph: (
          transform: (paragraph: Parameters<typeof transformDocxParagraph>[0]) => unknown,
        ) => (element: unknown) => unknown;
      };
    }
  ).transforms.paragraph(transformDocxParagraph),
};

export async function convertDocxBufferToEditorDoc(buffer: Buffer): Promise<EditorDoc> {
  const result = await mammoth.convertToHtml({ buffer }, mammothOptions);
  return {
    type: "doc",
    content: packContinuousTextBlock(htmlToEditorContent(result.value || "")),
  };
}

export async function convertDocxBufferToHtml(buffer: Buffer): Promise<string> {
  const result = await mammoth.convertToHtml({ buffer }, mammothOptions);
  return enhanceDocxHtmlForPrint(result.value || "<p></p>");
}

/** Prepare mammoth HTML for print/PDF. */
export function enhanceDocxHtmlForPrint(html: string): string {
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  body = body.replace(
    /<(p|div|h[1-6]|li)(\b[^>]*)?>\s*([_\u2013\u2014\-]{4,})\s*<\/\1>/gi,
    '<hr class="signature-line" />',
  );
  body = body.replace(/([_\u2013\u2014\-]{8,})/g, '<span class="signature-fill"></span>');

  body = body.replace(
    /^(?:\s)*<(p|h1|h2)(\b[^>]*)?>([\s\S]*?)<\/\1>/i,
    (full, tag: string, attrs = "", inner: string) => {
      const text = decodeEntities(inner.replace(/<[^>]+>/g, "")).replace(/\u00a0/g, " ").trim();
      if (!text || text.length > 120) return full;
      if (/text-align\s*:\s*center/i.test(attrs)) return full;
      const withStyle = /style=/i.test(attrs)
        ? attrs.replace(/style=(["'])(.*?)\1/i, (_m: string, q: string, style: string) => {
            return `style=${q}${String(style).replace(/;?\s*$/, "")}; text-align: center${q}`;
          })
        : `${attrs} style="text-align: center"`;
      const withClass = /class=/i.test(withStyle)
        ? withStyle.replace(/class=(["'])(.*?)\1/i, (_m: string, q: string, cls: string) => `class=${q}${cls} doc-title${q}`)
        : `${withStyle} class="doc-title"`;
      return `<${tag}${withClass}>${inner}</${tag}>`;
    },
  );

  return `<article class="docx-import">${body}</article>`;
}
