"use client";

import { EditorContent, type Editor } from "@tiptap/react";
import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type ReactNode } from "react";
import {
  pageCountForHeight,
  pageSizeSpec,
  type PageSizeId,
} from "@/lib/editor/page-geometry";
import { CreatorBlockControls } from "./creator-block-controls";
import { CreatorSelectionToolbar } from "./creator-selection-toolbar";
import { FIELD_DRAG_MIME } from "./field-types";
import { SlashInsertMenu } from "./slash-insert-menu";

type Props = {
  editor: Editor | null;
  pageSize?: PageSizeId;
  onDropField: (type: string, clientX: number, clientY: number) => void;
  onPageCountChange?: (count: number) => void;
  children?: ReactNode;
};

export function CreatorCanvas({
  editor,
  pageSize = "letter",
  onDropField,
  onPageCountChange,
  children,
}: Props) {
  const paperRef = useRef<HTMLDivElement>(null);
  const spec = pageSizeSpec(pageSize);
  const [guideCount, setGuideCount] = useState(1);

  useEffect(() => {
    const paper = paperRef.current;
    if (!paper) {
      return;
    }
    const measure = () => {
      const pages = pageCountForHeight(paper.scrollHeight, spec.heightPx);
      setGuideCount(pages);
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
      <div className="mx-auto py-8 pl-16 pr-8" style={{ width: spec.widthPx + 96 }}>
        <div
          ref={paperRef}
          data-creator-paper
          className="creator-paper relative rounded-sm bg-white shadow-[0_8px_30px_rgba(15,23,42,0.08)] ring-1 ring-black/5"
          style={
            {
              "--creator-page-width": `${spec.widthPx}px`,
              "--creator-page-height": `${spec.heightPx}px`,
              "--creator-page-margin": `${spec.marginPx}px`,
              width: spec.widthPx,
            } as CSSProperties
          }
        >
          <div className="creator-margin-guide" aria-hidden />
          <div className="creator-page-guides" aria-hidden>
            {Array.from({ length: Math.max(0, guideCount - 1) }, (_, index) => (
              <div
                key={index}
                className="creator-page-guide"
                data-page-label={`Page ${index + 2}`}
                style={{ top: (index + 1) * spec.heightPx }}
              />
            ))}
          </div>
          <EditorContent editor={editor} />
          <CreatorBlockControls editor={editor} paperRef={paperRef} />
          <CreatorSelectionToolbar editor={editor} paperRef={paperRef} />
          <SlashInsertMenu editor={editor} paperRef={paperRef} />
          {children}
        </div>
      </div>
    </div>
  );
}
