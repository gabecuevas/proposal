"use client";

import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import type { DragEvent } from "react";
import { assetUrl } from "@/lib/storage/asset-url";

export function FieldCanvasView({ node }: NodeViewProps) {
  const bgKey = String(node.attrs.bgKey ?? "");
  const pageNumber = Number(node.attrs.pageNumber ?? 0);
  // Height is the editor sheet (see `.tiptap-creator .field-canvas`). The page
  // image letterboxes inside that box so a Letter scan cannot overflow onto
  // the next visual page.
  // A canvas stands in for a sheet of paper, so it stays white regardless of the OS
  // colour scheme — the same surface the exported PDF renders onto.

  return (
    <NodeViewWrapper
      className={`field-canvas relative w-full overflow-visible bg-white ${
        bgKey ? "" : "border border-dashed border-slate-300 shadow-inner"
      }`}
      style={{
        width: "100%",
        height: "var(--field-canvas-height, calc(var(--creator-page-height, 1056px) - 2 * var(--creator-page-margin, 48px)))",
        maxHeight:
          "var(--field-canvas-height, calc(var(--creator-page-height, 1056px) - 2 * var(--creator-page-margin, 48px)))",
        margin: 0,
      }}
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
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={assetUrl(bgKey)}
            alt={pageNumber ? `Page ${pageNumber}` : "Page background"}
            className="h-full w-full select-none object-fill"
            draggable={false}
          />
        </div>
      ) : null}
      <NodeViewContent className="field-canvas-content relative block h-full w-full" />
      {pageNumber ? (
        <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-slate-900/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {pageNumber}
        </span>
      ) : null}
    </NodeViewWrapper>
  );
}
