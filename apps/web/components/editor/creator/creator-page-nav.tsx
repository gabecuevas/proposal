"use client";

import { useCallback, useEffect, useState, type RefObject } from "react";
import {
  PAGE_GAP_PX,
  pageAtVisualOffset,
  pageSizeSpec,
  visualTopForPage,
  type PageSizeId,
} from "@/lib/editor/page-geometry";

const STORAGE_KEY = "doxysign-page-preview-open";
const THUMB_WIDTH = 120;

type Props = {
  paperRef: RefObject<HTMLDivElement | null>;
  scrollerRef: RefObject<HTMLDivElement | null>;
  pageCount: number;
  currentPage: number;
  pageSize?: PageSizeId;
  name?: string;
};

function readOpen(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function CreatorPageNav({
  paperRef,
  scrollerRef,
  pageCount,
  currentPage,
  pageSize = "letter",
  name = "Document",
}: Props) {
  const spec = pageSizeSpec(pageSize);
  const [open, setOpen] = useState(false);
  const [sourceHtml, setSourceHtml] = useState("");
  const pages = Math.max(1, pageCount);
  const thumbHeight = Math.round(THUMB_WIDTH * (spec.heightPx / spec.widthPx));
  const scale = THUMB_WIDTH / spec.widthPx;

  useEffect(() => {
    setOpen(readOpen());
  }, []);

  useEffect(() => {
    const paper = paperRef.current;
    const source = paper?.querySelector(".tiptap-creator, .ProseMirror") as HTMLElement | null;
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
    observer.observe(source, { subtree: true, childList: true, characterData: true, attributes: true });
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
    const paperTop = paper.offsetTop;
    scroller.scrollTo({
      top: paperTop + visualTopForPage(pageIndex, spec.heightPx, PAGE_GAP_PX) - 24,
      behavior: "smooth",
    });
  }

  if (!open) {
    return (
      <div className="flex w-9 shrink-0 flex-col items-center border-r border-border bg-surface py-3">
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
    <aside className="flex w-[196px] shrink-0 flex-col border-r border-border bg-surface">
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
      <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label="Page thumbnails">
        {Array.from({ length: pages }, (_, index) => {
          const active = currentPage === index + 1;
          return (
            <button
              key={index}
              type="button"
              onClick={() => jumpTo(index)}
              aria-current={active ? "page" : undefined}
              className={`mb-2 flex w-full flex-col items-start gap-1 rounded-md p-1.5 text-left ${
                active ? "bg-slate-100 shadow-[inset_-2px_0_0_var(--primary)]" : "hover:bg-slate-50"
              }`}
            >
              <span className="px-0.5 text-[11px] text-muted">{index + 1} · Page</span>
              <span
                className={`relative block overflow-hidden rounded border bg-white shadow-sm ${
                  active ? "border-primary" : "border-border"
                }`}
                style={{ width: THUMB_WIDTH, height: thumbHeight }}
              >
                <span
                  className="creator-page-thumb pointer-events-none absolute left-0 top-0 origin-top-left"
                  style={{
                    width: spec.widthPx,
                    transform: `translateY(${-visualTopForPage(index, spec.heightPx, PAGE_GAP_PX)}px) scale(${scale})`,
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

export function readVisiblePage(scroller: HTMLElement, paper: HTMLElement, pageHeightPx: number): number {
  const y = scroller.scrollTop - paper.offsetTop + 48;
  return pageAtVisualOffset(Math.max(0, y), pageHeightPx, PAGE_GAP_PX) + 1;
}
