"use client";

import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { DragEvent } from "react";
import { fieldCanvasAspectRatio } from "@/lib/editor/extensions/field-canvas";
import { assetUrl } from "@/lib/storage/asset-url";

export function FieldCanvasView({ node }: NodeViewProps) {
  const bgKey = String(node.attrs.bgKey ?? "");
  const pageNumber = Number(node.attrs.pageNumber ?? 0);
  const aspectRatio = fieldCanvasAspectRatio(node.attrs.pageWidth, node.attrs.pageHeight);
  // A page image already fixes the height via the aspect ratio; pairing that with a
  // min-height makes the width resolve against the intrinsic image size instead.
  const minHeight = bgKey ? undefined : 420;
  // A canvas stands in for a sheet of paper, so it stays white regardless of the OS
  // colour scheme — the same surface the exported PDF renders onto.

  return (
    <NodeViewWrapper
      className={`field-canvas relative w-full overflow-hidden rounded-lg border bg-white ${
        bgKey ? "border-slate-200 shadow-sm" : "border-dashed border-slate-300 shadow-inner"
      }`}
      style={{ aspectRatio, minHeight }}
      data-field-canvas
      data-page-number={pageNumber || undefined}
      onDragOver={(event: DragEvent<HTMLElement>) => {
        if (event.dataTransfer.types.includes("application/x-signer-field")) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "copy";
        }
      }}
    >
      {bgKey ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={assetUrl(bgKey)}
          alt={pageNumber ? `Page ${pageNumber}` : "Page background"}
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
          draggable={false}
        />
      ) : null}
      <NodeViewContent className="field-canvas-content relative block min-h-[inherit] w-full" />
      {pageNumber ? (
        <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-slate-900/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {pageNumber}
        </span>
      ) : null}
    </NodeViewWrapper>
  );
}
