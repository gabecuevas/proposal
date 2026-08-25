"use client";

import { EditorContent, type Editor } from "@tiptap/react";
import { useEffect, useRef, type CSSProperties, type DragEvent, type ReactNode } from "react";
import { PAGE_GAP_PX, pageCountForPaperHeight, pageSizeSpec, type PageSizeId } from "@/lib/editor/page-geometry";
import { CreatorBlockControls } from "./creator-block-controls";
import { CreatorSelectionToolbar } from "./creator-selection-toolbar";
import { FIELD_DRAG_MIME } from "./field-types";
import { SlashInsertMenu } from "./slash-insert-menu";

type Props = {
  editor: Editor | null;
  pageSize?: PageSizeId;
  onDropField: (type: string, clientX: number, clientY: number) => void;
  onPageCountChange?: (count: number) => void;
  documentId?: string;
  templateId?: string;
  children?: ReactNode;
};

export function CreatorCanvas({
  editor,
  pageSize = "letter",
  onDropField,
  onPageCountChange,
  documentId,
  templateId,
  children,
}: Props) {
  const paperRef = useRef<HTMLDivElement>(null);
  const spec = pageSizeSpec(pageSize);

  useEffect(() => {
    const paper = paperRef.current;
    if (!paper) {
      return;
    }
    const measure = () => {
      const pages = pageCountForPaperHeight(paper.scrollHeight, spec.heightPx, PAGE_GAP_PX);
      onPageCountChange?.(pages);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(paper);
    return () => observer.disconnect();
  }, [editor, onPageCountChange, spec.heightPx]);

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
    <div
      className="relative min-h-0 flex-1 overflow-auto bg-slate-200/70"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="mx-auto py-8 pl-16 pr-16" style={{ width: spec.widthPx + 128 }}>
        <div
          ref={paperRef}
          data-creator-paper
          className="creator-paper relative"
          style={
            {
              "--creator-page-width": `${spec.widthPx}px`,
              "--creator-page-height": `${spec.heightPx}px`,
              "--creator-page-margin": `${spec.marginPx}px`,
              "--creator-page-gap": `${PAGE_GAP_PX}px`,
              "--creator-flow-break-height": `${spec.marginPx * 2 + PAGE_GAP_PX}px`,
              width: spec.widthPx,
            } as CSSProperties
          }
        >
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
    </div>
  );
}
