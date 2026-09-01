"use client";

import type { NodeViewProps } from "@tiptap/react";
import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import { applyCornerResize, snapCornerResize, snapRect, type AlignGuide, type FieldRect, type ResizeCorner } from "@/lib/editor/field-snap";
import {
  overlayParentAt,
  parseOverlayLayout,
} from "@/lib/editor/overlay-text-box";
import { PAGE_MARGIN_PX, readPaperPageGapPx, readPaperPageHeightPx, visualTopForPage } from "@/lib/editor/page-geometry";
import { FIELD_OPTIONS_MENU_WIDTH, placeFieldMenu } from "@/lib/editor/place-field-menu";
import { BlockOptionsMenu } from "./creator/block-options-menu";
import { useCreatorChrome } from "./creator/creator-chrome-context";
import { IconDragHandle, IconGear } from "./creator/creator-icons";

const MIN_W_PCT = 0.08;
const MIN_H_PCT = 0.035;
const OVERLAY_MENU_HEIGHT = 520;

type Container = {
  element: HTMLElement;
  widthPx: number;
  heightPx: number;
  pageHeightPx: number;
  gapPx: number;
  isOverlay: boolean;
};

function resolveContainer(fieldEl: HTMLElement): Container | null {
  const overlay = fieldEl.closest("[data-field-overlay]") as HTMLElement | null;
  if (overlay) {
    const rect = overlay.getBoundingClientRect();
    return {
      element: overlay,
      widthPx: rect.width,
      heightPx: rect.height,
      pageHeightPx: readPaperPageHeightPx(overlay),
      gapPx: readPaperPageGapPx(overlay),
      isOverlay: true,
    };
  }
  const canvas = fieldEl.closest("[data-field-canvas]") as HTMLElement | null;
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      element: canvas,
      widthPx: rect.width,
      heightPx: rect.height,
      pageHeightPx: rect.height,
      gapPx: 0,
      isOverlay: false,
    };
  }
  return null;
}

function visualY(page: number, yPct: number, pageHeightPx: number, gapPx: number): number {
  return visualTopForPage(page, pageHeightPx, gapPx) + yPct * pageHeightPx;
}

function collectSnapTargets(container: HTMLElement, selfId: string): FieldRect[] {
  const origin = container.getBoundingClientRect();
  const rects: FieldRect[] = [];
  const selector = "[data-signer-field-id], [data-overlay-text-box-id]";
  for (const node of container.querySelectorAll(selector)) {
    if (!(node instanceof HTMLElement)) {
      continue;
    }
    if (node.getAttribute("data-overlay-text-box-id") === selfId) {
      continue;
    }
    const rect = node.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4) {
      continue;
    }
    rects.push({
      left: rect.left - origin.left,
      top: rect.top - origin.top,
      width: rect.width,
      height: rect.height,
    });
  }
  return rects;
}

function AlignGuides({ container, guides }: { container: HTMLElement; guides: AlignGuide[] }) {
  if (guides.length === 0) {
    return null;
  }
  return createPortal(
    <div className="pointer-events-none absolute inset-0 z-[60]" aria-hidden>
      {guides.map((guide, index) =>
        guide.axis === "x" ? (
          <div
            key={`x-${index}`}
            className="absolute top-0 bottom-0 w-px bg-[var(--overlay-text-box,#1e3a5f)]"
            style={{ left: guide.position }}
          />
        ) : (
          <div
            key={`y-${index}`}
            className="absolute left-0 right-0 h-px bg-[var(--overlay-text-box,#1e3a5f)]"
            style={{ top: guide.position }}
          />
        ),
      )}
    </div>,
    container,
  );
}

const CORNERS: { id: ResizeCorner; className: string; cursor: string }[] = [
  { id: "nw", className: "-left-1.5 -top-1.5", cursor: "nwse-resize" },
  { id: "ne", className: "-right-1.5 -top-1.5", cursor: "nesw-resize" },
  { id: "sw", className: "-left-1.5 -bottom-1.5", cursor: "nesw-resize" },
  { id: "se", className: "-right-1.5 -bottom-1.5", cursor: "nwse-resize" },
];

export function TextBoxView({ node, updateAttributes, selected, editor, getPos }: NodeViewProps) {
  const chrome = useCreatorChrome();
  const rootRef = useRef<HTMLDivElement>(null);
  const gearRef = useRef<HTMLButtonElement>(null);
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const hoverLeaveTimer = useRef<number | null>(null);
  const [guides, setGuides] = useState<{ container: HTMLElement; lines: AlignGuide[] } | null>(null);
  const [menuCoords, setMenuCoords] = useState<ReturnType<typeof placeFieldMenu> | null>(null);

  const pos = typeof getPos === "function" ? getPos() : undefined;
  const overlayParent =
    typeof pos === "number" ? overlayParentAt(editor, pos) : isOverlayTextBoxParentHint(node.attrs);
  const overlay = overlayParent != null;
  const layout = useMemo(
    () => parseOverlayLayout(node.attrs as Record<string, unknown>),
    [node.attrs],
  );
  const caretInside =
    typeof pos === "number" &&
    editor.state.selection.from > pos &&
    editor.state.selection.from < pos + node.nodeSize;
  const nodeSelected =
    selected &&
    editor.state.selection instanceof NodeSelection &&
    typeof pos === "number" &&
    editor.state.selection.from === pos;
  const isEditing = Boolean(nodeSelected || caretInside || menuOpen);
  const chromeVisible = isEditing || hovered;
  const showBorder = chromeVisible;

  useEffect(() => {
    return () => {
      if (hoverLeaveTimer.current != null) {
        window.clearTimeout(hoverLeaveTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    const renderer = rootRef.current?.closest(".text-box-renderer");
    if (!(renderer instanceof HTMLElement)) {
      return;
    }
    renderer.classList.toggle("is-field-chrome-up", showBorder);
    return () => {
      renderer.classList.remove("is-field-chrome-up");
    };
  }, [showBorder]);

  useEffect(() => {
    if (!menuOpen) {
      setMenuCoords(null);
      return;
    }
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (gearRef.current?.contains(target)) {
        return;
      }
      if (target instanceof Element && target.closest("[data-text-box-options]")) {
        return;
      }
      setMenuOpen(false);
    }
    function place() {
      const anchor = gearRef.current?.getBoundingClientRect();
      if (!anchor) {
        return;
      }
      setMenuCoords(
        placeFieldMenu(
          {
            top: anchor.top,
            left: anchor.left,
            right: anchor.right,
            bottom: anchor.bottom,
            width: anchor.width,
            height: anchor.height,
          },
          { width: window.innerWidth, height: window.innerHeight },
          FIELD_OPTIONS_MENU_WIDTH,
          OVERLAY_MENU_HEIGHT,
          "end",
        ),
      );
    }
    place();
    const listen = window.setTimeout(() => {
      document.addEventListener("mousedown", onPointerDown);
    }, 0);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.clearTimeout(listen);
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [menuOpen]);

  const selectThis = useCallback(() => {
    const live = getPos();
    if (typeof live !== "number") {
      return;
    }
    const { selection } = editor.state;
    const already = selection instanceof NodeSelection && selection.from === live;
    if (!already) {
      editor.view.dispatch(editor.state.tr.setSelection(NodeSelection.create(editor.state.doc, live)));
    }
  }, [editor, getPos]);

  const onDragPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || !overlay) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      selectThis();

      const container = resolveContainer(event.currentTarget as HTMLElement);
      if (!container || container.widthPx <= 0) {
        return;
      }

      const startLeft = layout.xPct * container.widthPx;
      const startTop = visualY(layout.page, layout.yPct, container.pageHeightPx, container.gapPx);
      const width = layout.wPct * container.widthPx;
      const height = layout.hPct * container.pageHeightPx;
      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const others = collectSnapTargets(container.element, layout.boxId);

      const onMove = (moveEvent: globalThis.PointerEvent) => {
        const next = snapRect(
          {
            left: startLeft + (moveEvent.clientX - startClientX),
            top: startTop + (moveEvent.clientY - startClientY),
            width,
            height,
          },
          others,
          { width: container.widthPx, height: container.heightPx, margin: PAGE_MARGIN_PX },
        );
        setGuides({ container: container.element, lines: next.guides });
        const nextPage = container.isOverlay
          ? Math.max(0, Math.floor(next.top / (container.pageHeightPx + container.gapPx)))
          : layout.page;
        const yOnPage = container.isOverlay
          ? next.top - visualTopForPage(nextPage, container.pageHeightPx, container.gapPx)
          : next.top;
        updateAttributes({
          xPct: Math.min(1 - layout.wPct, Math.max(0, next.left / container.widthPx)),
          yPct: Math.min(1 - layout.hPct, Math.max(0, yOnPage / container.pageHeightPx)),
          page: nextPage,
        });
      };

      const onUp = () => {
        setGuides(null);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [layout, overlay, selectThis, updateAttributes],
  );

  const onResizePointerDown = useCallback(
    (corner: ResizeCorner) => (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0 || !overlay) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      selectThis();

      const container = resolveContainer(rootRef.current ?? (event.currentTarget as HTMLElement));
      if (!container || container.widthPx <= 0) {
        return;
      }

      const start: FieldRect = {
        left: layout.xPct * container.widthPx,
        top: visualY(layout.page, layout.yPct, container.pageHeightPx, container.gapPx),
        width: layout.wPct * container.widthPx,
        height: layout.hPct * container.pageHeightPx,
      };
      const minW = MIN_W_PCT * container.widthPx;
      const minH = MIN_H_PCT * container.pageHeightPx;
      const startClientX = event.clientX;
      const startClientY = event.clientY;
      const others = collectSnapTargets(container.element, layout.boxId);

      const onMove = (moveEvent: globalThis.PointerEvent) => {
        const resized = applyCornerResize(
          start,
          corner,
          moveEvent.clientX - startClientX,
          moveEvent.clientY - startClientY,
          minW,
          minH,
        );
        const next = snapCornerResize(resized, corner, others, {
          width: container.widthPx,
          height: container.heightPx,
          margin: PAGE_MARGIN_PX,
        });
        setGuides({ container: container.element, lines: next.guides });
        const nextPage = container.isOverlay
          ? Math.max(0, Math.floor(next.top / (container.pageHeightPx + container.gapPx)))
          : layout.page;
        const yOnPage = container.isOverlay
          ? next.top - visualTopForPage(nextPage, container.pageHeightPx, container.gapPx)
          : next.top;
        updateAttributes({
          xPct: Math.min(1, Math.max(0, next.left / container.widthPx)),
          yPct: Math.min(1, Math.max(0, yOnPage / container.pageHeightPx)),
          wPct: Math.min(1, Math.max(MIN_W_PCT, next.width / container.widthPx)),
          hPct: Math.min(1, Math.max(MIN_H_PCT, next.height / container.pageHeightPx)),
          page: nextPage,
        });
      };

      const onUp = () => {
        setGuides(null);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [layout, overlay, selectThis, updateAttributes],
  );

  if (!overlay) {
    return (
      <NodeViewWrapper className="creator-text-box" data-node-type="textBox">
        <NodeViewContent className="creator-text-box-content" />
      </NodeViewWrapper>
    );
  }

  const positionVars = {
    "--field-x": layout.xPct,
    "--field-y": layout.yPct,
    "--field-w": layout.wPct,
    "--field-h": layout.hPct,
    "--field-page": layout.page,
    "--overlay-z": layout.zIndex,
  } as CSSProperties;

  const livePos = typeof getPos === "function" ? getPos() : undefined;

  return (
    <NodeViewWrapper
      className={`overlay-text-box overflow-visible ${showBorder ? "z-40" : "z-20"}`}
      style={positionVars}
      data-node-type="textBox"
      data-overlay-text-box-id={layout.boxId}
      data-field-page={layout.page}
      data-chrome={chromeVisible ? "on" : showBorder ? "hover" : "off"}
      onPointerEnter={() => {
        if (hoverLeaveTimer.current != null) {
          window.clearTimeout(hoverLeaveTimer.current);
          hoverLeaveTimer.current = null;
        }
        setHovered(true);
      }}
      onPointerLeave={(event: React.PointerEvent) => {
        const next = event.relatedTarget;
        if (
          next instanceof Node &&
          (rootRef.current?.contains(next) ||
            (next instanceof Element && next.closest("[data-text-box-options]")))
        ) {
          return;
        }
        hoverLeaveTimer.current = window.setTimeout(() => {
          setHovered(false);
          hoverLeaveTimer.current = null;
        }, 160);
      }}
    >
      <div ref={rootRef} className="relative h-full w-full">
        {guides ? <AlignGuides container={guides.container} guides={guides.lines} /> : null}

        {chromeVisible ? (
          <span
            data-overlay-drag
            role="img"
            aria-label="Move text box"
            title="Drag to move"
            contentEditable={false}
            onPointerDown={onDragPointerDown}
            className="absolute left-0 top-1/2 z-30 flex h-7 -translate-x-full -translate-y-1/2 cursor-grab items-center pr-1 text-[var(--overlay-text-box,#1e3a5f)] active:cursor-grabbing"
          >
            <IconDragHandle className="h-4 w-4" />
          </span>
        ) : null}

        {chromeVisible ? (
          <div data-overlay-gear className="absolute right-0 top-1/2 z-30 -translate-y-1/2 translate-x-full pl-1">
            <button
              ref={gearRef}
              type="button"
              aria-label="Text box options"
              title="Text box options"
              aria-expanded={menuOpen}
              contentEditable={false}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--overlay-text-box,#1e3a5f)] text-white shadow-sm hover:opacity-95"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                const anchor = event.currentTarget.getBoundingClientRect();
                setMenuCoords(
                  placeFieldMenu(
                    {
                      top: anchor.top,
                      left: anchor.left,
                      right: anchor.right,
                      bottom: anchor.bottom,
                      width: anchor.width,
                      height: anchor.height,
                    },
                    { width: window.innerWidth, height: window.innerHeight },
                    FIELD_OPTIONS_MENU_WIDTH,
                    OVERLAY_MENU_HEIGHT,
                    "end",
                  ),
                );
                setMenuOpen((open) => !open);
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              <IconGear className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        <div
          className={`overlay-text-box-frame h-full w-full overflow-auto rounded-[2px] ${
            showBorder ? "overlay-text-box-frame-active" : "overlay-text-box-frame-idle"
          }`}
        >
          <NodeViewContent className="overlay-text-box-content" />
        </div>

        {chromeVisible
          ? CORNERS.map((corner) => (
              <span
                key={corner.id}
                data-resize-handle
                data-resize-corner={corner.id}
                role="presentation"
                aria-label={`Resize ${corner.id}`}
                title="Drag to resize"
                contentEditable={false}
                onPointerDown={onResizePointerDown(corner.id)}
                className={`absolute z-30 h-3 w-3 rounded-full border-2 border-white bg-[var(--overlay-text-box,#1e3a5f)] shadow-sm ${corner.className}`}
                style={{ cursor: corner.cursor }}
              />
            ))
          : null}
      </div>

      {menuOpen && menuCoords && typeof livePos === "number" && typeof document !== "undefined"
        ? createPortal(
            <div
              data-text-box-options
              className="z-[80]"
              style={{
                position: "fixed",
                top: menuCoords.top,
                bottom: menuCoords.bottom,
                left: menuCoords.left,
                maxHeight: menuCoords.maxHeight,
              }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <BlockOptionsMenu
                editor={editor}
                pos={livePos}
                documentId={chrome.documentId}
                templateId={chrome.templateId}
                showArrange
                onClose={() => setMenuOpen(false)}
              />
            </div>,
            document.body,
          )
        : null}
    </NodeViewWrapper>
  );
}

function isOverlayTextBoxParentHint(attrs: Record<string, unknown>): "fieldCanvas" | null {
  return String(attrs.boxId ?? "") ? "fieldCanvas" : null;
}
