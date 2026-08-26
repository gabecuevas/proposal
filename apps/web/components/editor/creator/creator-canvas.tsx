"use client";

import { EditorContent, type Editor } from "@tiptap/react";
import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import {
  PAGE_GAP_PX,
  pageCountForPaperHeight,
  pageSizeSpec,
  visualTopForPage,
  type PageSizeId,
} from "@/lib/editor/page-geometry";
import { CreatorBlockControls } from "./creator-block-controls";
import { CreatorPageNav, readVisiblePage } from "./creator-page-nav";
import { CreatorSelectionToolbar } from "./creator-selection-toolbar";
import { FIELD_DRAG_MIME } from "./field-types";
import { SlashInsertMenu } from "./slash-insert-menu";

/** Editor-only gutter for block handles. Not part of the printable page. */
const PAPER_CHROME_GUTTER_PX = 64;

type Props = {
  editor: Editor | null;
  pageSize?: PageSizeId;
  onDropField: (type: string, clientX: number, clientY: number) => void;
  onPageCountChange?: (count: number) => void;
  onVisiblePageChange?: (page: number) => void;
  documentId?: string;
  templateId?: string;
  documentName?: string;
  children?: ReactNode;
};

export function CreatorCanvas({
  editor,
  pageSize = "letter",
  onDropField,
  onPageCountChange,
  onVisiblePageChange,
  documentId,
  templateId,
  documentName,
  children,
}: Props) {
  const paperRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const spec = pageSizeSpec(pageSize);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const paper = paperRef.current;
    const scroller = scrollerRef.current;
    if (!paper) {
      return;
    }
    const measure = () => {
      const pages = pageCountForPaperHeight(paper.scrollHeight, spec.heightPx, PAGE_GAP_PX);
      setPageCount(pages);
      onPageCountChange?.(pages);
      if (scroller) {
        const visible = readVisiblePage(scroller, paper, spec.heightPx);
        setCurrentPage(visible);
        onVisiblePageChange?.(visible);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(paper);
    scroller?.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      scroller?.removeEventListener("scroll", measure);
    };
  }, [editor, onPageCountChange, onVisiblePageChange, spec.heightPx]);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const centerOverflowX = () => {
      const extra = scroller.scrollWidth - scroller.clientWidth;
      scroller.scrollLeft = extra > 0 ? Math.round(extra / 2) : 0;
    };
    centerOverflowX();
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(centerOverflowX);
    });
    observer.observe(scroller);
    if (paperRef.current) {
      observer.observe(paperRef.current);
    }
    return () => observer.disconnect();
  }, [spec.widthPx]);

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    if (event.dataTransfer.types.includes(FIELD_DRAG_MIME)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    const type = event.dataTransfer.getData(FIELD_DRAG_MIME);
    if (!type) {
      return;
    }
    event.preventDefault();
    onDropField(type, event.clientX, event.clientY);
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1" onDragOver={onDragOver} onDrop={onDrop}>
      <CreatorPageNav
        paperRef={paperRef}
        scrollerRef={scrollerRef}
        pageCount={pageCount}
        currentPage={currentPage}
        pageSize={pageSize}
        name={documentName}
      />
      <div
        ref={scrollerRef}
        className="relative flex min-h-0 min-w-0 flex-1 overflow-auto bg-slate-200/70"
      >
        {/* Flexible chrome only. Must yield before the paper so sidebars never clip the sheet. */}
        <div
          aria-hidden
          className="min-w-0"
          style={{ flex: `1 1 ${PAPER_CHROME_GUTTER_PX}px` }}
        />
        <div className="shrink-0 py-10">
          <div
            ref={paperRef}
            data-creator-paper
            className="creator-paper relative shrink-0"
            style={
              {
                "--creator-page-width": `${spec.widthPx}px`,
                "--creator-page-height": `${spec.heightPx}px`,
                "--creator-page-margin": `${spec.marginPx}px`,
                "--creator-page-gap": `${PAGE_GAP_PX}px`,
                "--creator-flow-break-height": `${spec.marginPx * 2 + PAGE_GAP_PX}px`,
                width: spec.widthPx,
                minWidth: spec.widthPx,
                maxWidth: spec.widthPx,
              } as CSSProperties
            }
          >
            {Array.from({ length: pageCount }, (_, index) => (
              <div
                key={index}
                className="creator-page-index"
                style={{ top: visualTopForPage(index, spec.heightPx, PAGE_GAP_PX) }}
                aria-hidden
              >
                Page {index + 1} of {pageCount}
              </div>
            ))}
            <EditorContent editor={editor} />
            <CreatorBlockControls
              editor={editor}
              paperRef={paperRef}
              documentId={documentId}
              templateId={templateId}
            />
            <CreatorSelectionToolbar editor={editor} paperRef={paperRef} />
            <SlashInsertMenu editor={editor} paperRef={paperRef} />
            {children}
          </div>
        </div>
        <div
          aria-hidden
          className="min-w-0"
          style={{ flex: `1 1 ${PAPER_CHROME_GUTTER_PX}px` }}
        />
      </div>
    </div>
  );
}
