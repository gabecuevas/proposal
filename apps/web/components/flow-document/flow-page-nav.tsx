"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import {
  pageAtVisualOffset,
  pageThumbContentTransform,
  pageThumbHeightPx,
  stackedPaperHeightPx,
  visualTopForPage,
} from "@/lib/editor/page-geometry";

const STORAGE_KEY = "senddox-page-preview-open";
const THUMB_WIDTH = 120;
const FLOW_PAGE_GAP_PX = 32;

type Props = {
  paperRef: RefObject<HTMLDivElement | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  pageCount: number;
  currentPage: number;
  pageWidthPx: number;
  pageHeightPx: number;
  /** Zoom percent (100 = 1×). Used when scrolling to a page. */
  zoom?: number;
  name?: string;
  pageGapPx?: number;
};

function readOpen(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function FlowPageNav({
  paperRef,
  scrollerRef,
  pageCount,
  currentPage,
  pageWidthPx,
  pageHeightPx,
  zoom = 100,
  name = "Document",
  pageGapPx = FLOW_PAGE_GAP_PX,
}: Props) {
  const [open, setOpen] = useState(false);
  const [sourceHtml, setSourceHtml] = useState("");
  const pages = Math.max(1, pageCount);
  const thumbHeight = pageThumbHeightPx(THUMB_WIDTH, pageWidthPx, pageHeightPx);
  const scale = THUMB_WIDTH / pageWidthPx;

  useEffect(() => {
    setOpen(readOpen());
  }, []);

  useEffect(() => {
    const paper = paperRef.current;
    const source = paper?.querySelector(".ProseMirror") as HTMLElement | null;
    if (!source) {
      return;
    }
    let timer = 0;
    const capture = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setSourceHtml(source.outerHTML), 280);
    };
    capture();
    const observer = new MutationObserver(capture);
    observer.observe(source, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [paperRef, pages]);

  const toggle = useCallback(() => {
    setOpen((value) => {
      const next = !value;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  function jumpTo(pageIndex: number) {
    const scroller = scrollerRef.current;
    const paper = paperRef.current;
    if (!scroller || !paper) {
      return;
    }
    const zoomScale = Math.max(0.1, zoom / 100);
    const scrollerRect = scroller.getBoundingClientRect();
    const paperRect = paper.getBoundingClientRect();
    const paperContentTop = scroller.scrollTop + (paperRect.top - scrollerRect.top);
    const pageTop = visualTopForPage(pageIndex, pageHeightPx, pageGapPx) * zoomScale;
    scroller.scrollTo({
      top: Math.max(0, paperContentTop + pageTop - 24),
      behavior: "smooth",
    });
  }

  if (!open) {
    return (
      <div className="flow-page-nav flex w-9 shrink-0 flex-col items-center border-r border-border bg-surface py-3">
        <button
          type="button"
          onClick={toggle}
          className="flex h-7 w-7 items-center justify-center rounded text-muted hover:bg-slate-100 hover:text-foreground"
          aria-label="Show page preview"
          title="Show page preview"
        >
          »
        </button>
      </div>
    );
  }

  return (
    <aside className="flow-page-nav flex w-[196px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-start justify-between gap-1 border-b border-border px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Document preview</p>
          <p className="mt-1 truncate text-sm font-medium text-foreground" title={name}>
            {name}
          </p>
          <p className="text-[11px] text-muted">
            Document · {pages} {pages === 1 ? "page" : "pages"}
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          className="mt-0.5 flex h-6 w-6 items-center justify-center rounded text-muted hover:bg-slate-100 hover:text-foreground"
          aria-label="Hide page preview"
          title="Hide page preview"
        >
          «
        </button>
      </div>
      <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-label="Page thumbnails">
        {Array.from({ length: pages }, (_, index) => {
          const active = currentPage === index + 1;
          return (
            <button
              key={index}
              type="button"
              onClick={() => jumpTo(index)}
              aria-current={active ? "page" : undefined}
              className="mx-auto mb-3 flex w-fit flex-col items-center gap-1.5 last:mb-0"
            >
              <span className={`text-[11px] ${active ? "font-medium text-foreground" : "text-muted"}`}>
                {index + 1} · Page
              </span>
              <span
                className={`relative block overflow-hidden bg-white shadow-sm ${
                  active ? "border-2 border-primary" : "border border-border"
                }`}
                style={{ width: THUMB_WIDTH, height: thumbHeight }}
              >
                <span
                  className="flow-page-thumb pointer-events-none absolute left-0 top-0 origin-top-left"
                  data-flow-thumb="true"
                  style={{
                    width: pageWidthPx,
                    height: stackedPaperHeightPx(pages, pageHeightPx, pageGapPx),
                    transform: pageThumbContentTransform(index, pageHeightPx, pageGapPx, scale),
                  }}
                  dangerouslySetInnerHTML={sourceHtml ? { __html: sourceHtml } : undefined}
                />
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/** 1-based page index for the viewport focus inside the Flow scroll pane. */
export function readFlowVisiblePage(
  scroller: HTMLElement,
  paper: HTMLElement,
  pageHeightPx: number,
  gapPx = FLOW_PAGE_GAP_PX,
  zoom = 100,
): number {
  const zoomScale = Math.max(0.1, zoom / 100);
  const scrollerRect = scroller.getBoundingClientRect();
  const paperRect = paper.getBoundingClientRect();
  const paperContentTop = scroller.scrollTop + (paperRect.top - scrollerRect.top);
  const focusY = scroller.scrollTop + 48 - paperContentTop;
  const unscaledY = focusY / zoomScale;
  return pageAtVisualOffset(Math.max(0, unscaledY), pageHeightPx, gapPx) + 1;
}
