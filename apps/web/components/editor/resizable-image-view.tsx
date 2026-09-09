"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useCallback, useRef } from "react";
import {
  clampImageWidth,
  IMAGE_MAX_WIDTH_PCT,
  IMAGE_MIN_WIDTH_PCT,
  parseImageAlign,
  type ImageAlign,
} from "@/lib/editor/extensions/resizable-image";
import { IconAlignCenter, IconAlignLeft, IconAlignRight, IconTrash } from "./creator/creator-icons";

const alignToJustify: Record<ImageAlign, string> = {
  left: "flex-start",
  center: "center",
  right: "flex-end",
};

export function ResizableImageView({
  node,
  updateAttributes,
  selected,
  editor,
  deleteNode,
}: NodeViewProps) {
  const src = String(node.attrs.src ?? "");
  const alt = String(node.attrs.alt ?? "");
  const widthPct = clampImageWidth(node.attrs.widthPct);
  const align = parseImageAlign(node.attrs.align);
  const frameRef = useRef<HTMLDivElement>(null);

  const startResize = useCallback(
    (event: React.PointerEvent, edge: "left" | "right") => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();

      const column = frameRef.current?.parentElement;
      if (!column) {
        return;
      }
      const columnWidth = column.getBoundingClientRect().width;
      const startX = event.clientX;
      const startWidth = widthPct;

      const onMove = (moveEvent: PointerEvent) => {
        const delta = ((moveEvent.clientX - startX) / columnWidth) * 100;
        const next = edge === "right" ? startWidth + delta * 2 : startWidth - delta * 2;
        updateAttributes({ widthPct: clampImageWidth(next) });
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [updateAttributes, widthPct],
  );

  return (
    <NodeViewWrapper
      className="creator-image-block"
      style={{ display: "flex", justifyContent: alignToJustify[align] }}
      data-align={align}
    >
      <div
        ref={frameRef}
        className={`group relative inline-block max-w-full ${
          selected ? "outline outline-2 outline-offset-2 outline-primary" : ""
        }`}
        style={{ width: `${widthPct}%` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className="block h-auto w-full select-none" draggable={false} />

        {editor.isEditable ? (
          <>
            <ResizeGrip position="left" onPointerDown={(event) => startResize(event, "left")} />
            <ResizeGrip position="right" onPointerDown={(event) => startResize(event, "right")} />
            <div
              className={`absolute -top-9 left-1/2 z-20 -translate-x-1/2 items-center gap-0.5 rounded-md border border-border bg-surface px-1 py-1 shadow-md ${
                selected ? "flex" : "hidden"
              }`}
              contentEditable={false}
            >
              <ToolbarButton
                label="Align left"
                active={align === "left"}
                onClick={() => updateAttributes({ align: "left" })}
              >
                <IconAlignLeft className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                label="Align center"
                active={align === "center"}
                onClick={() => updateAttributes({ align: "center" })}
              >
                <IconAlignCenter className="h-3.5 w-3.5" />
              </ToolbarButton>
              <ToolbarButton
                label="Align right"
                active={align === "right"}
                onClick={() => updateAttributes({ align: "right" })}
              >
                <IconAlignRight className="h-3.5 w-3.5" />
              </ToolbarButton>
              <span className="mx-1 h-4 w-px bg-border" />
              {[33, 50, 75, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => updateAttributes({ widthPct: preset })}
                  className={`rounded px-1.5 py-0.5 text-[11px] ${
                    widthPct === preset
                      ? "bg-primary text-primary-foreground"
                      : "text-muted hover:bg-slate-100"
                  }`}
                >
                  {preset}%
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-border" />
              <ToolbarButton label="Remove image" onClick={deleteNode}>
                <IconTrash className="h-3.5 w-3.5" />
              </ToolbarButton>
            </div>
          </>
        ) : null}
      </div>
    </NodeViewWrapper>
  );
}

function ResizeGrip({
  position,
  onPointerDown,
}: {
  position: "left" | "right";
  onPointerDown: (event: React.PointerEvent) => void;
}) {
  return (
    <span
      role="presentation"
      onPointerDown={onPointerDown}
      title={`Drag to resize (${IMAGE_MIN_WIDTH_PCT}–${IMAGE_MAX_WIDTH_PCT}%)`}
      className={`absolute top-1/2 z-20 h-10 w-2 -translate-y-1/2 cursor-ew-resize rounded-full bg-primary/80 opacity-0 transition-opacity group-hover:opacity-100 ${
        position === "left" ? "-left-1" : "-right-1"
      }`}
    />
  );
}

function ToolbarButton({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`rounded p-1 ${
        active ? "bg-primary/10 text-primary" : "text-muted hover:bg-slate-100 hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
