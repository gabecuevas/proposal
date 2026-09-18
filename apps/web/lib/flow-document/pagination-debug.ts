/**
 * Opt-in Flow pagination / paste diagnostics.
 *
 * Enable with `?flowDebug=1` or `localStorage.flowDebug = "1"`, then:
 * - paste Google Docs / Word HTML and watch the console group
 * - call `window.__flowDebug.dump()` for a live PaginationPlus snapshot
 */

import { measurePaginationPlusPageCount } from "@/lib/flow-document/measure-pages";

export type FlowPaginationSnapshot = {
  at: string;
  pageCount: number;
  scrollHeight: number;
  clientHeight: number;
  minHeight: string;
  tables: number;
  images: number;
  paragraphs: number;
  hardBreaks: number;
  explicitPageBreaks: number;
  lastGapPx: number | null;
  pageContentAreaHeightPx: number | null;
  cssVars: Record<string, string>;
  lastChildren: Array<{ tag: string; className: string; height: number }>;
};

export type FlowPasteDebugEvent = {
  at: string;
  source: "transformPastedHTML";
  rawBytes: number;
  cleanBytes: number;
  rawTables: number;
  rawImages: number;
  rawWidthStyles: number;
  rawHeightStyles: number;
  rawTransforms: number;
  cleanTables: number;
  cleanImages: number;
  sampleRaw: string;
  sampleClean: string;
};

declare global {
  interface Window {
    __flowDebug?: {
      enabled: boolean;
      history: FlowPaginationSnapshot[];
      pastes: FlowPasteDebugEvent[];
      dump: () => FlowPaginationSnapshot | null;
      watch: (ms?: number) => () => void;
      pasteHtml?: (html: string) => void;
      selectAll?: () => void;
      clearDoc?: () => void;
      clearTableBorders?: () => void;
    };
  }
}

export function isFlowPaginationDebugEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    if (window.localStorage.getItem("flowDebug") === "1") {
      return true;
    }
  } catch {
    // ignore private-mode storage failures
  }
  return new URLSearchParams(window.location.search).has("flowDebug");
}

function countTag(html: string, tag: string): number {
  const re = new RegExp(`<${tag}\\b`, "gi");
  return html.match(re)?.length ?? 0;
}

function sample(html: string, max = 280): string {
  const compact = html.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : `${compact.slice(0, max)}…`;
}

export function summarizePastedHtml(raw: string, clean: string): FlowPasteDebugEvent {
  return {
    at: new Date().toISOString(),
    source: "transformPastedHTML",
    rawBytes: raw.length,
    cleanBytes: clean.length,
    rawTables: countTag(raw, "table"),
    rawImages: countTag(raw, "img"),
    rawWidthStyles: (raw.match(/width\s*:/gi) ?? []).length,
    rawHeightStyles: (raw.match(/height\s*:/gi) ?? []).length,
    rawTransforms: (raw.match(/transform\s*:/gi) ?? []).length,
    cleanTables: countTag(clean, "table"),
    cleanImages: countTag(clean, "img"),
    sampleRaw: sample(raw),
    sampleClean: sample(clean),
  };
}

export function captureFlowPaginationSnapshot(dom: HTMLElement | null | undefined): FlowPaginationSnapshot | null {
  if (!dom) {
    return null;
  }
  const pagination = dom.querySelector("[data-rm-pagination]");
  const lastChild = dom.lastElementChild as HTMLElement | null;
  const lastBreaker = pagination?.lastElementChild?.querySelector(".breaker") as HTMLElement | null;
  let lastGapPx: number | null = null;
  if (lastChild && lastBreaker) {
    lastGapPx = lastChild.getBoundingClientRect().bottom - lastBreaker.getBoundingClientRect().bottom;
  }

  const pageHeight = parseFloat(dom.style.getPropertyValue("--rm-page-height") || "") || null;
  const marginTop = parseFloat(dom.style.getPropertyValue("--rm-margin-top") || "") || 0;
  const marginBottom = parseFloat(dom.style.getPropertyValue("--rm-margin-bottom") || "") || 0;
  const contentTop = parseFloat(dom.style.getPropertyValue("--rm-content-margin-top") || "") || 0;
  const contentBottom = parseFloat(dom.style.getPropertyValue("--rm-content-margin-bottom") || "") || 0;
  const pageContentAreaHeightPx =
    pageHeight == null ? null : pageHeight - marginTop - marginBottom - contentTop - contentBottom;

  const children = Array.from(dom.children).slice(-8) as HTMLElement[];
  const cssVarNames = [
    "--rm-page-height",
    "--rm-page-width",
    "--rm-margin-top",
    "--rm-margin-bottom",
    "--rm-max-content-child-height",
    "--rm-page-content-first",
    "--rm-page-content-general",
  ];
  const cssVars: Record<string, string> = {};
  for (const name of cssVarNames) {
    const value = dom.style.getPropertyValue(name);
    if (value) {
      cssVars[name] = value;
    }
  }

  return {
    at: new Date().toISOString(),
    pageCount: measurePaginationPlusPageCount(dom),
    scrollHeight: dom.scrollHeight,
    clientHeight: dom.clientHeight,
    minHeight: dom.style.minHeight || "",
    tables: dom.querySelectorAll("table").length,
    images: dom.querySelectorAll("img").length,
    paragraphs: dom.querySelectorAll("p").length,
    hardBreaks: dom.querySelectorAll("br").length,
    explicitPageBreaks: dom.querySelectorAll("[data-flow-page-break], .flow-page-break").length,
    lastGapPx,
    pageContentAreaHeightPx,
    cssVars,
    lastChildren: children.map((el) => ({
      tag: el.tagName.toLowerCase(),
      className: typeof el.className === "string" ? el.className.slice(0, 80) : "",
      height: Math.round(el.getBoundingClientRect().height),
    })),
  };
}

export function logFlowPasteDebug(event: FlowPasteDebugEvent): void {
  if (!isFlowPaginationDebugEnabled()) {
    return;
  }
  console.groupCollapsed(
    `[flowDebug] paste ${event.rawBytes}→${event.cleanBytes}B tables=${event.rawTables} imgs=${event.rawImages}`,
  );
  console.log(event);
  console.groupEnd();
  ensureFlowDebugApi();
  window.__flowDebug?.pastes.push(event);
}

export function logFlowPaginationSnapshot(
  label: string,
  dom: HTMLElement | null | undefined,
  extra?: Record<string, unknown>,
): FlowPaginationSnapshot | null {
  if (!isFlowPaginationDebugEnabled()) {
    return null;
  }
  const snapshot = captureFlowPaginationSnapshot(dom);
  if (!snapshot) {
    return null;
  }
  console.groupCollapsed(
    `[flowDebug] ${label} pages=${snapshot.pageCount} gap=${snapshot.lastGapPx?.toFixed?.(1) ?? "n/a"}px minH=${snapshot.minHeight || "auto"}`,
  );
  console.log(snapshot, extra ?? {});
  console.groupEnd();
  ensureFlowDebugApi();
  window.__flowDebug?.history.push(snapshot);
  // Keep a bounded ring buffer so long sessions stay light.
  if (window.__flowDebug && window.__flowDebug.history.length > 80) {
    window.__flowDebug.history.splice(0, window.__flowDebug.history.length - 80);
  }
  return snapshot;
}

export function ensureFlowDebugApi(
  getDom?: () => HTMLElement | null | undefined,
  helpers?: {
    pasteHtml?: (html: string) => void;
    selectAll?: () => void;
    clearDoc?: () => void;
    clearTableBorders?: () => void;
  },
): void {
  if (typeof window === "undefined") {
    return;
  }
  if (!isFlowPaginationDebugEnabled()) {
    return;
  }
  const history = window.__flowDebug?.history ?? [];
  const pastes = window.__flowDebug?.pastes ?? [];
  const prevPasteHtml = window.__flowDebug?.pasteHtml;
  const prevSelectAll = window.__flowDebug?.selectAll;
  const prevClearDoc = window.__flowDebug?.clearDoc;
  const prevClearTableBorders = window.__flowDebug?.clearTableBorders;
  let stopWatch: (() => void) | undefined;
  window.__flowDebug = {
    enabled: true,
    history,
    pastes,
    dump: () => {
      const dom = getDom?.() ?? (document.querySelector(".flow-document-editor") as HTMLElement | null);
      const snapshot = captureFlowPaginationSnapshot(dom);
      console.log("[flowDebug] dump", snapshot);
      return snapshot;
    },
    watch: (ms = 500) => {
      stopWatch?.();
      const id = window.setInterval(() => {
        const dom = getDom?.() ?? (document.querySelector(".flow-document-editor") as HTMLElement | null);
        logFlowPaginationSnapshot("watch", dom);
      }, ms);
      stopWatch = () => window.clearInterval(id);
      return stopWatch;
    },
    pasteHtml: helpers?.pasteHtml ?? prevPasteHtml,
    selectAll: helpers?.selectAll ?? prevSelectAll,
    clearDoc: helpers?.clearDoc ?? prevClearDoc,
    clearTableBorders: helpers?.clearTableBorders ?? prevClearTableBorders,
  };
}
