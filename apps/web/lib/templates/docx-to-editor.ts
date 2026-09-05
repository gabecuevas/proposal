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
  "p[style-name='Title'] => h1.doc-title:fresh",
  "p[style-name='title'] => h1.doc-title:fresh",
  "p[style-name='Subtitle'] => h2.doc-subtitle:fresh",
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "r[style-name='Strong'] => strong",
  "p[style-name='Quote'] => blockquote > p:fresh",
  "p[style-name='Intense Quote'] => blockquote > p:fresh",
];

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
): EditorNode {
  const attrs = align ? { textAlign: align } : undefined;
  return {
    type: "paragraph",
    attrs,
    content: content.length > 0 ? content : undefined,
  };
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
  let openHeading: number | null = null;
  let inBlockquote = false;
  let listType: "bulletList" | "orderedList" | null = null;
  let listItems: EditorNode[] = [];
  let listItemParas: EditorNode[] = [];
  let inListItem = false;
  const spanStyleStack: Array<{ bold: boolean; italic: boolean; underline: boolean }> = [];

  function pushInline(text: string) {
    const node = makeText(text, state);
    if (node) inline.push(node);
  }

  function emitBlock(node: EditorNode) {
    if (inListItem) {
      listItemParas.push(node);
      return;
    }
    if (inBlockquote) {
      const last = blocks[blocks.length - 1];
      if (last?.type === "blockquote") {
        last.content = [...(last.content ?? []), node];
      } else {
        blocks.push({ type: "blockquote", content: [node] });
      }
      return;
    }
    blocks.push(node);
  }

  function flushInlineAsParagraph() {
    if (openHeading !== null) {
      const level = Math.min(3, Math.max(1, openHeading));
      emitBlock({
        type: "heading",
        attrs: {
          level,
          ...(pendingAlign ? { textAlign: pendingAlign } : {}),
        },
        content: inline.length > 0 ? inline : undefined,
      });
      inline = [];
      pendingAlign = null;
      openHeading = null;
      return;
    }

    const text = plainTextOf(inline).replace(/\u00a0/g, " ").trim();
    if (isSignatureLineText(text)) {
      emitBlock({ type: "horizontalRule" });
      inline = [];
      pendingAlign = null;
      return;
    }

    if (inline.length === 0) {
      pendingAlign = null;
      return;
    }

    const fillOnly = inline.filter(
      (n) => !(n.type === "text" && isSignatureLineText(String(n.text ?? "").trim())),
    );
    const hadFill = fillOnly.length !== inline.length;
    if (fillOnly.length > 0 || !hadFill) {
      emitBlock(paragraphNode(hadFill ? fillOnly : inline, pendingAlign));
    }
    if (hadFill) {
      emitBlock({ type: "horizontalRule" });
    }
    inline = [];
    pendingAlign = null;
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
      emitBlock({ type: "horizontalRule" });
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
        pendingAlign =
          parseStyleAlign(getAttr(rawAttrs, "style")) ??
          (hasClass(rawAttrs, "doc-title") ? "center" : null);
      } else if (tag === "blockquote") {
        flushInlineAsParagraph();
        inBlockquote = true;
        blocks.push({ type: "blockquote", content: [] });
      } else if (tag === "p" || tag === "div") {
        flushInlineAsParagraph();
        pendingAlign =
          parseStyleAlign(getAttr(rawAttrs, "style")) ??
          (hasClass(rawAttrs, "doc-title") ? "center" : null);
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
};

export async function convertDocxBufferToEditorDoc(buffer: Buffer): Promise<EditorDoc> {
  const result = await mammoth.convertToHtml({ buffer }, mammothOptions);
  return {
    type: "doc",
    content: htmlToEditorContent(result.value || ""),
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
        ? attrs.replace(/style=(["'])(.*?)\1/i, (_m, q, style) => {
            return `style=${q}${String(style).replace(/;?\s*$/, "")}; text-align: center${q}`;
          })
        : `${attrs} style="text-align: center"`;
      const withClass = /class=/i.test(withStyle)
        ? withStyle.replace(/class=(["'])(.*?)\1/i, (_m, q, cls) => `class=${q}${cls} doc-title${q}`)
        : `${withStyle} class="doc-title"`;
      return `<${tag}${withClass}>${inner}</${tag}>`;
    },
  );

  return `<article class="docx-import">${body}</article>`;
}
