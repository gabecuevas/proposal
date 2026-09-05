"use client";

import { EditorContent, type Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import {
  PAGE_GAP_PX,
  pageCountForHeight,
  pageCountForPaperHeight,
  pageSizeSpec,
  visualTopForPage,
  type PageSizeId,
} from "@/lib/editor/page-geometry";
import {
  deleteVisualPage,
  duplicateVisualPage,
  savePageToLibrary,
} from "@/lib/editor/page-actions";
import { CreatorBlockControls } from "./creator-block-controls";
import { BlankPageStarter } from "./blank-page-starter";
import { CreatorChromeProvider } from "./creator-chrome-context";
import { CreatorPageBackgrounds } from "./creator-page-backgrounds";
import { CreatorPageMenu } from "./creator-page-menu";
import { CreatorPageNav, readVisiblePage } from "./creator-page-nav";
import { useCreatorPageActions } from "./creator-page-workspace";
import { CreatorSelectionToolbar } from "./creator-selection-toolbar";
import { FIELD_DRAG_MIME } from "./field-types";
import { SlashInsertMenu } from "./slash-insert-menu";
import { copySignerFieldNode, readCopiedSignerField } from "@/lib/editor/field-clipboard";
import { pasteCopiedSignerField } from "@/lib/editor/insert-signer-field";
import { FIELD_DROP_EVENT, type FieldDropDetail } from "@/lib/editor/field-drag";

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
  variableKeys?: string[];
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
  variableKeys = [],
  children,
}: Props) {
  const paperRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const spec = pageSizeSpec(pageSize);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuPage, setOpenMenuPage] = useState<number | null>(null);
  const [pageBacked, setPageBacked] = useState(false);
  const pageActions = useCreatorPageActions();
  const pageGapPx = pageBacked ? PAGE_GAP_PX : 0;

  useEffect(() => {
    const paper = paperRef.current;
    const scroller = scrollerRef.current;
    if (!paper) {
      return;
    }
    const measure = () => {
      const flow = paper.querySelector(".ProseMirror") as HTMLElement | null;
      const backed = flow?.classList.contains("is-page-backed") ?? false;
      setPageBacked(backed);
      const gapPx = backed ? PAGE_GAP_PX : 0;
      const canvasCount = flow?.querySelectorAll("[data-field-canvas]").length ?? 0;
      const pages =
        backed && canvasCount > 0
          ? canvasCount
          : backed
            ? pageCountForPaperHeight(
                flow?.scrollHeight || paper.scrollHeight,
                spec.heightPx,
                PAGE_GAP_PX,
              )
            : pageCountForHeight(flow?.scrollHeight || paper.scrollHeight, spec.heightPx);
      setPageCount(pages);
      onPageCountChange?.(pages);
      if (scroller) {
        const visible = readVisiblePage(scroller, paper, spec.heightPx, gapPx);
        setCurrentPage(visible);
        onVisiblePageChange?.(visible);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(paper);
    const flow = paper.querySelector(".ProseMirror");
    if (flow) {
      observer.observe(flow);
    }
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
      scroller.scrollLeft = extra > 2 ? Math.round(extra / 2) : 0;
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

  useEffect(() => {
    function onFieldKeys(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (!editor) {
        return;
      }
      const key = event.key.toLowerCase();
      const { selection } = editor.state;
      const fieldSelected =
        selection instanceof NodeSelection && selection.node.type.name === "signerField";

      if (key === "v") {
        const copied = readCopiedSignerField();
        if (!copied) {
          return;
        }
        event.preventDefault();
        pasteCopiedSignerField(editor, copied);
        return;
      }

      if (!fieldSelected) {
        return;
      }
      if (key === "c") {
        event.preventDefault();
        copySignerFieldNode({ type: "signerField", attrs: { ...selection.node.attrs } });
        return;
      }
      if (key === "x") {
        event.preventDefault();
        copySignerFieldNode({ type: "signerField", attrs: { ...selection.node.attrs } });
        editor.chain().focus().deleteRange({ from: selection.from, to: selection.to }).run();
      }
    }
    window.addEventListener("keydown", onFieldKeys);
    return () => window.removeEventListener("keydown", onFieldKeys);
  }, [editor]);

  useEffect(() => {
    function onFieldDrop(event: Event) {
      const detail = (event as CustomEvent<FieldDropDetail>).detail;
      if (!detail?.type) {
        return;
      }
      onDropField(detail.type, detail.clientX, detail.clientY);
    }
    window.addEventListener(FIELD_DROP_EVENT, onFieldDrop);
    return () => window.removeEventListener(FIELD_DROP_EVENT, onFieldDrop);
  }, [onDropField]);

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
    <CreatorChromeProvider documentId={documentId} templateId={templateId} editor={editor}>
    <div className="flex min-h-0 min-w-0 flex-1" onDragOver={onDragOver} onDrop={onDrop}>
      <CreatorPageNav
        paperRef={paperRef}
        scrollerRef={scrollerRef}
        pageCount={pageCount}
        currentPage={currentPage}
        pageSize={pageSize}
        name={documentName}
        pageGapPx={pageGapPx}
      />
      <div
        ref={scrollerRef}
        className="relative flex min-h-0 min-w-0 flex-1 overflow-auto bg-slate-200/70 [scrollbar-gutter:stable]"
      >
        {/* Flexible chrome only. Must yield before the paper so sidebars never clip the sheet. */}
        <div
          aria-hidden
          className="min-w-0"
          style={{ flex: `1 1 ${PAPER_CHROME_GUTTER_PX}px` }}
        />
        <div
          className="shrink-0 py-10"
          style={{ paddingLeft: PAPER_CHROME_GUTTER_PX, paddingRight: PAPER_CHROME_GUTTER_PX }}
        >
          <div
            ref={paperRef}
            data-creator-paper
            className="creator-paper relative shrink-0"
            style={
              {
                "--creator-page-width": `${spec.widthPx}px`,
                "--creator-page-height": `${spec.heightPx}px`,
                "--creator-page-margin": `${spec.marginPx}px`,
                "--creator-page-gap": `${pageGapPx}px`,
                "--creator-flow-break-height": pageBacked ? `${spec.marginPx * 2 + PAGE_GAP_PX}px` : "0px",
                width: spec.widthPx,
                minWidth: spec.widthPx,
                maxWidth: spec.widthPx,
              } as CSSProperties
            }
          >
            {!pageBacked && pageCount > 1 ? (
              <div className="creator-page-guides" aria-hidden>
                {Array.from({ length: pageCount - 1 }, (_, index) => (
                  <div
                    key={`guide-${index + 1}`}
                    className="creator-page-guide"
                    data-page-label="Estimated page break"
                    style={{ top: (index + 1) * spec.heightPx }}
                  />
                ))}
              </div>
            ) : null}
            {Array.from({ length: pageCount }, (_, index) => (
              <div
                key={index}
                className="creator-page-chrome"
                style={{ top: visualTopForPage(index, spec.heightPx, pageGapPx) }}
              >
                <div className="creator-page-index">
                  Page {index + 1} of {pageCount}
                </div>
                {pageActions ? (
                  <CreatorPageMenu
                    page={index + 1}
                    pageCount={pageCount}
                    open={openMenuPage === index + 1}
                    onToggle={() => setOpenMenuPage((current) => (current === index + 1 ? null : index + 1))}
                    onClose={() => setOpenMenuPage(null)}
                    onPageProperties={() => pageActions.openPageProperties(index + 1)}
                    onImportBackground={() => pageActions.openImportBackground(index + 1)}
                    onDuplicate={() => {
                      if (!editor) {
                        return;
                      }
                      duplicateVisualPage(editor, paperRef.current, index);
                    }}
                    onSaveToLibrary={async () => {
                      if (!editor) {
                        return "Could not save";
                      }
                      const result = await savePageToLibrary(editor, paperRef.current, index);
                      return result.message;
                    }}
                    onDelete={() => {
                      if (!editor) {
                        return;
                      }
                      deleteVisualPage(editor, paperRef.current, index, pageCount);
                    }}
                  />
                ) : null}
              </div>
            ))}
            <div data-creator-surface className="relative">
              <CreatorPageBackgrounds editor={editor} pageCount={pageCount} spec={spec} />
              <EditorContent editor={editor} />
              <BlankPageStarter editor={editor} variableKeys={variableKeys} />
            </div>
            <CreatorBlockControls
              editor={editor}
              paperRef={paperRef}
              scrollerRef={scrollerRef}
              documentId={documentId}
              templateId={templateId}
              pageSize={pageSize}
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
    </CreatorChromeProvider>
  );
}
