import type { Editor } from "@tiptap/core";
import type { EditorDoc, JSONValue } from "@/lib/editor/types";

export type FlowChromeRegion = "header" | "footer";

export type FlowPageChromeState = {
  headerEnabled: boolean;
  footerEnabled: boolean;
  differentFirstPage: boolean;
  differentOddEven: boolean;
  showPageNumbers: boolean;
  /** Inches from top of page to header (Google Docs default 0.5). */
  headerMarginInches: number;
  /** Inches from bottom of page to footer (Google Docs default 0.5). */
  footerMarginInches: number;
  headerText: string;
  footerText: string;
  firstHeaderText: string;
  firstFooterText: string;
  evenHeaderText: string;
  evenFooterText: string;
};

export const FLOW_PAGE_CHROME_ATTR = "flow_page_chrome";

export const DEFAULT_FLOW_PAGE_CHROME: FlowPageChromeState = {
  headerEnabled: false,
  footerEnabled: false,
  differentFirstPage: false,
  differentOddEven: false,
  showPageNumbers: false,
  headerMarginInches: 0.5,
  footerMarginInches: 0.5,
  headerText: "",
  footerText: "",
  firstHeaderText: "",
  firstFooterText: "",
  evenHeaderText: "",
  evenFooterText: "",
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function asInches(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return Math.min(3, Math.round(n * 100) / 100);
}

export function parseFlowPageChrome(raw: unknown): FlowPageChromeState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_FLOW_PAGE_CHROME };
  }
  const obj = raw as Record<string, unknown>;
  return {
    headerEnabled: asBoolean(obj.headerEnabled),
    footerEnabled: asBoolean(obj.footerEnabled),
    differentFirstPage: asBoolean(obj.differentFirstPage),
    differentOddEven: asBoolean(obj.differentOddEven),
    showPageNumbers: asBoolean(obj.showPageNumbers),
    headerMarginInches: asInches(obj.headerMarginInches, 0.5),
    footerMarginInches: asInches(obj.footerMarginInches, 0.5),
    headerText: asString(obj.headerText),
    footerText: asString(obj.footerText),
    firstHeaderText: asString(obj.firstHeaderText),
    firstFooterText: asString(obj.firstFooterText),
    evenHeaderText: asString(obj.evenHeaderText),
    evenFooterText: asString(obj.evenFooterText),
  };
}

export function flowPageChromeFromDoc(doc: EditorDoc | null | undefined): FlowPageChromeState {
  return parseFlowPageChrome(doc?.attrs?.[FLOW_PAGE_CHROME_ATTR]);
}

export function withFlowPageChrome(doc: EditorDoc, chrome: FlowPageChromeState): EditorDoc {
  const next = structuredClone(doc);
  next.attrs = { ...(next.attrs ?? {}) };
  next.attrs[FLOW_PAGE_CHROME_ATTR] = chrome as unknown as JSONValue;
  return next;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert plain text (with newlines) to simple HTML for PaginationPlus header/footer slots. */
export function plainTextToChromeHtml(text: string): string {
  const trimmed = text.trimEnd();
  if (!trimmed) {
    return "";
  }
  return escapeHtml(trimmed).replace(/\n/g, "<br/>");
}

export function inchesToPx(inches: number): number {
  return Math.round(inches * 96);
}

type ApplyChromeOptions = {
  pageCount?: number;
  marginLeftPx?: number;
  marginRightPx?: number;
};

function headerHtmlForPage(chrome: FlowPageChromeState, page: number): string {
  if (!chrome.headerEnabled) {
    return "";
  }
  if (chrome.differentFirstPage && page === 1) {
    return plainTextToChromeHtml(chrome.firstHeaderText);
  }
  if (chrome.differentOddEven && page % 2 === 0) {
    return plainTextToChromeHtml(chrome.evenHeaderText);
  }
  return plainTextToChromeHtml(chrome.headerText);
}

function footerHtmlForPage(chrome: FlowPageChromeState, page: number): { left: string; right: string } {
  const right = chrome.showPageNumbers ? "{page}" : "";
  if (!chrome.footerEnabled && !chrome.showPageNumbers) {
    return { left: "", right: "" };
  }
  if (!chrome.footerEnabled) {
    return { left: "", right };
  }
  if (chrome.differentFirstPage && page === 1) {
    return { left: plainTextToChromeHtml(chrome.firstFooterText), right };
  }
  if (chrome.differentOddEven && page % 2 === 0) {
    return { left: plainTextToChromeHtml(chrome.evenFooterText), right };
  }
  return { left: plainTextToChromeHtml(chrome.footerText), right };
}

type PaginationPlusStorage = {
  customHeader?: Record<number, { headerLeft: string; headerRight: string }>;
  customFooter?: Record<number, { footerLeft: string; footerRight: string }>;
};

function paginationPlusStorage(editor: Editor): PaginationPlusStorage | null {
  const storage = (editor.storage as { PaginationPlus?: PaginationPlusStorage }).PaginationPlus;
  return storage ?? null;
}

/**
 * Whether header/footer content varies by page number (needs per-page PaginationPlus slots).
 * When false, avoid writing customHeader/customFooter keys — those force per-page height
 * vars and can feed a page-count ↔ chrome re-apply loop after large pastes.
 */
export function chromeNeedsPerPageSlots(chrome: FlowPageChromeState): boolean {
  return chrome.differentFirstPage || chrome.differentOddEven || chrome.showPageNumbers;
}

/**
 * Push Flow page chrome settings into PaginationPlus decorations + margins.
 */
export function applyFlowPageChromeToEditor(
  editor: Editor,
  chrome: FlowPageChromeState,
  options: ApplyChromeOptions = {},
): void {
  const marginLeft = options.marginLeftPx ?? 96;
  const marginRight = options.marginRightPx ?? 96;
  editor.commands.updateMargins({
    top: inchesToPx(chrome.headerMarginInches),
    bottom: inchesToPx(chrome.footerMarginInches),
    left: marginLeft,
    right: marginRight,
  });

  const storage = paginationPlusStorage(editor);
  // Always reset per-page maps before rewriting so page-count growth cannot
  // accumulate stale customHeader/customFooter entries forever.
  if (storage) {
    storage.customHeader = {};
    storage.customFooter = {};
  }

  const defaultFooter = footerHtmlForPage(chrome, chrome.differentOddEven ? 1 : 2);
  editor.commands.updateHeaderContent(
    chrome.headerEnabled ? plainTextToChromeHtml(chrome.headerText) : "",
    "",
  );
  editor.commands.updateFooterContent(defaultFooter.left, defaultFooter.right);

  if (!chromeNeedsPerPageSlots(chrome)) {
    return;
  }

  const pageCount = Math.max(1, options.pageCount ?? 1);
  for (let page = 1; page <= pageCount; page += 1) {
    const header = headerHtmlForPage(chrome, page);
    const footer = footerHtmlForPage(chrome, page);
    editor.commands.updateHeaderContent(header, "", page);
    editor.commands.updateFooterContent(footer.left, footer.right, page);
  }

  if (chrome.differentOddEven) {
    const defaultHeader = headerHtmlForPage(chrome, 1);
    editor.commands.updateHeaderContent(defaultHeader, "");
  }
}
