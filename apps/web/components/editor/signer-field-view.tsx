"use client";

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewWrapper } from "@tiptap/react";
import { useCallback, useMemo, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { clamp01, parseSignerFieldAttrs } from "@/lib/editor/signer-field-attrs";
import { readPaperPageHeightPx } from "@/lib/editor/page-geometry";
import { useSignerRecipients } from "./signer-field-context";

const MIN_W_PCT = 0.06;
const MIN_H_PCT = 0.02;

function typeLabel(type: string): string {
  switch (type) {
    case "signature":
      return "Signature";
    case "initial":
      return "Initials";
    case "date":
      return "Date";
    case "text":
      return "Text";
    case "checkbox":
      return "Checkbox";
    case "dropdown":
      return "Dropdown";
    default:
      return type;
  }
}

/**
 * A field inside `fieldOverlay` measures its vertical position against a single
 * page, while a field inside `fieldCanvas` measures against that canvas. Both
 * cases publish the same CSS variables and let the container stylesheet decide
 * how to read them.
 */
type Container = { element: HTMLElement; verticalUnitPx: number; widthPx: number };

function resolveContainer(fieldEl: HTMLElement): Container | null {
  const overlay = fieldEl.closest("[data-field-overlay]") as HTMLElement | null;
  if (overlay) {
    const rect = overlay.getBoundingClientRect();
    return { element: overlay, verticalUnitPx: readPaperPageHeightPx(overlay), widthPx: rect.width };
  }
  const canvas = fieldEl.closest("[data-field-canvas]") as HTMLElement | null;
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    return { element: canvas, verticalUnitPx: rect.height, widthPx: rect.width };
  }
  return null;
}

export function SignerFieldView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const recipients = useSignerRecipients();
  const attrs = useMemo(
    () => parseSignerFieldAttrs(node.attrs as Record<string, unknown>, 0),
    [node.attrs],
  );
  const recipientName = recipients.find((r) => r.id === attrs.recipientId)?.name ?? attrs.recipientId;

  const selectThis = useCallback(() => {
    const pos = getPos();
    if (typeof pos !== "number") {
      return;
    }
    editor.chain().focus().setNodeSelection(pos).run();
  }, [editor, getPos]);

  const onDragPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      selectThis();

      const container = resolveContainer(event.currentTarget as HTMLElement);
      if (!container || container.widthPx <= 0 || container.verticalUnitPx <= 0) {
        return;
      }

      const isOverlay = container.element.hasAttribute("data-field-overlay");
      const startAbsoluteY = attrs.page + attrs.yPct;
      const startX = attrs.xPct;
      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const maxX = Math.max(0, 1 - attrs.wPct);
      const pageCount = isOverlay
        ? Math.max(1, Math.round(container.element.getBoundingClientRect().height / container.verticalUnitPx))
        : 1;

      const onMove = (moveEvent: globalThis.PointerEvent) => {
        const dx = (moveEvent.clientX - startClientX) / container.widthPx;
        const dy = (moveEvent.clientY - startClientY) / container.verticalUnitPx;
        const nextX = Math.min(maxX, clamp01(startX + dx));
        const rawY = Math.max(0, startAbsoluteY + dy);
        const cappedY = Math.min(rawY, Math.max(0, pageCount - attrs.hPct));
        const page = isOverlay ? Math.floor(cappedY) : 0;
        const yPct = Math.min(Math.max(0, 1 - attrs.hPct), cappedY - page);
        updateAttributes({ xPct: nextX, yPct, page });
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [attrs.hPct, attrs.page, attrs.wPct, attrs.xPct, attrs.yPct, selectThis, updateAttributes],
  );

  const onResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      selectThis();

      const container = resolveContainer(event.currentTarget as HTMLElement);
      if (!container || container.widthPx <= 0 || container.verticalUnitPx <= 0) {
        return;
      }

      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const startW = attrs.wPct;
      const startH = attrs.hPct;

      const onMove = (moveEvent: globalThis.PointerEvent) => {
        const dw = (moveEvent.clientX - startClientX) / container.widthPx;
        const dh = (moveEvent.clientY - startClientY) / container.verticalUnitPx;
        updateAttributes({
          wPct: Math.min(1 - attrs.xPct, Math.max(MIN_W_PCT, startW + dw)),
          hPct: Math.min(1 - attrs.yPct, Math.max(MIN_H_PCT, startH + dh)),
        });
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [attrs.hPct, attrs.wPct, attrs.xPct, attrs.yPct, selectThis, updateAttributes],
  );

  const displayLabel = attrs.label.trim() || typeLabel(attrs.type);
  const positionVars = {
    "--field-x": attrs.xPct,
    "--field-y": attrs.yPct,
    "--field-w": attrs.wPct,
    "--field-h": attrs.hPct,
    "--field-page": attrs.page,
  } as CSSProperties;

  return (
    <NodeViewWrapper
      className={`signer-field-node flex flex-col overflow-hidden rounded-md border bg-white/95 text-[11px] shadow-sm transition-shadow ${
        selected ? "z-30 border-primary ring-2 ring-primary/30" : "z-20 border-slate-300"
      }`}
      style={positionVars}
      data-signer-field-id={attrs.fieldId}
      data-field-page={attrs.page}
      contentEditable={false}
      onPointerDown={(event: ReactPointerEvent<HTMLElement>) => {
        if ((event.target as HTMLElement).closest("[data-drag-handle],[data-resize-handle]")) {
          return;
        }
        selectThis();
      }}
    >
      <button
        type="button"
        data-drag-handle
        className="absolute -left-0.5 -top-0.5 z-30 flex h-6 w-6 cursor-grab items-center justify-center rounded border border-border bg-surface text-[10px] text-muted active:cursor-grabbing"
        aria-label="Drag to position field"
        onPointerDown={onDragPointerDown}
      >
        ⠿
      </button>
      <div className="flex min-h-0 flex-1 flex-col px-1.5 pb-1 pt-5">
        <div className="truncate font-medium text-foreground">{displayLabel}</div>
        <div className="truncate text-[10px] text-muted">
          {recipientName}
          {attrs.required ? " · Required" : " · Optional"}
        </div>
        <div className="mt-0.5 truncate text-[10px] capitalize text-primary/90">{attrs.type}</div>
      </div>
      <span
        data-resize-handle
        role="presentation"
        aria-label="Resize field"
        title="Drag to resize field"
        onPointerDown={onResizePointerDown}
        className="absolute bottom-0 right-0 z-30 h-3 w-3 cursor-nwse-resize rounded-sm border-b-2 border-r-2 border-primary/70"
      />
    </NodeViewWrapper>
  );
}
