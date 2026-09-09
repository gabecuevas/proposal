"use client";

import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { isPageBackedSeamInsert } from "@/lib/editor/overlay-text-box";
import { hitTestBlocks, type TopLevelBlock } from "@/lib/editor/block-hit-test";
import { isScaffoldFlowNode } from "@/lib/editor/extensions/flow-gaps";
import { PAGE_GAP_PX, pageSizeSpec, type PageSizeId } from "@/lib/editor/page-geometry";
import { BlockOptionsMenu } from "./block-options-menu";
import { useCreatorChrome } from "./creator-chrome-context";
import { ElementMenu } from "./element-menu";
import { IconDragHandle, IconGear, IconPlus } from "./creator-icons";

/** Nodes that are not part of the reorderable flow. */
const PINNED_NODES = new Set(["fieldOverlay"]);

type HoverTarget = { pos: number; topPx: number; heightPx: number };
type DropTarget = { index: number; topPx: number };
type InsertSlot = { insertPos: number; topPx: number };

type Props = {
  editor: Editor | null;
  /** The paper element the handles are positioned against. */
  paperRef: React.RefObject<HTMLDivElement | null>;
  scrollerRef?: React.RefObject<HTMLDivElement | null>;
  documentId?: string;
  templateId?: string;
  pageSize?: PageSizeId;
};

function readHitTestOptions(paper: HTMLElement, pageSize: PageSizeId = "letter") {
  const spec = pageSizeSpec(pageSize);
  const marginRaw = Number.parseFloat(getComputedStyle(paper).getPropertyValue("--creator-page-margin"));
  const heightRaw = Number.parseFloat(getComputedStyle(paper).getPropertyValue("--creator-page-height"));
  const gapRaw = Number.parseFloat(getComputedStyle(paper).getPropertyValue("--creator-page-gap"));
  return {
    marginPx: Number.isFinite(marginRaw) ? marginRaw : spec.marginPx,
    pageHeightPx: Number.isFinite(heightRaw) ? heightRaw : spec.heightPx,
    gapPx: Number.isFinite(gapRaw) ? gapRaw : PAGE_GAP_PX,
  };
}

function readTopLevelBlocks(editor: Editor, paper: HTMLElement): TopLevelBlock[] {
  const paperTop = paper.getBoundingClientRect().top;
  const blocks: TopLevelBlock[] = [];
  editor.state.doc.forEach((node, offset, index) => {
    if (PINNED_NODES.has(node.type.name) || isScaffoldFlowNode(node)) {
      return;
    }
    const dom = editor.view.nodeDOM(offset);
    if (dom instanceof HTMLElement) {
      const rect = dom.getBoundingClientRect();
      blocks.push({
        index,
        pos: offset,
        size: node.nodeSize,
        top: rect.top - paperTop,
        bottom: rect.bottom - paperTop,
      });
    }
  });
  return blocks;
}

function selectedTopLevel(editor: Editor, paper: HTMLElement): TopLevelBlock | null {
  const { $from } = editor.state.selection;
  const pos = $from.depth === 0 ? $from.pos : $from.before(1);
  return readTopLevelBlocks(editor, paper).find((block) => block.pos === pos) ?? null;
}

function toHover(block: TopLevelBlock | null): HoverTarget | null {
  return block ? { pos: block.pos, topPx: block.top, heightPx: block.bottom - block.top } : null;
}

function isFieldTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    Boolean(target.closest(".signer-field-node, .overlay-text-box, [data-overlay-text-box-id]"))
  );
}

function isGapTarget(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest("[data-creator-insert-gap]"));
}

export function CreatorBlockControls({
  editor,
  paperRef,
  scrollerRef,
  documentId,
  templateId,
  pageSize = "letter",
}: Props) {
  const chrome = useCreatorChrome();
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [selected, setSelected] = useState<HoverTarget | null>(null);
  const [insertSlot, setInsertSlot] = useState<InsertSlot | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [addMenuSource, setAddMenuSource] = useState<"handle" | "below" | "gap">("handle");
  const [gearMenuOpen, setGearMenuOpen] = useState(false);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  /** Keep gear/handle visible while scrolling a tall Text Block. */
  const [stickyOffsetPx, setStickyOffsetPx] = useState(0);
  const draggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const menuOpen = addMenuOpen || gearMenuOpen;
  const selectedChrome = dismissed ? null : selected;
  const active = menuOpen ? hover ?? selectedChrome : hover;

  useEffect(() => {
    const paper = paperRef.current;
    const scroller =
      scrollerRef?.current ??
      (paper?.closest(".overflow-auto") as HTMLElement | null) ??
      null;
    if (!paper || !active) {
      setStickyOffsetPx(0);
      return;
    }
    const syncSticky = () => {
      const paperRect = paper.getBoundingClientRect();
      const viewportTop = scroller ? scroller.getBoundingClientRect().top + 12 : 12;
      const blockTopScreen = paperRect.top + active.topPx;
      const raw = viewportTop - blockTopScreen;
      const max = Math.max(0, active.heightPx - 36);
      setStickyOffsetPx(Math.max(0, Math.min(raw, max)));
    };
    syncSticky();
    scroller?.addEventListener("scroll", syncSticky, { passive: true });
    window.addEventListener("resize", syncSticky);
    return () => {
      scroller?.removeEventListener("scroll", syncSticky);
      window.removeEventListener("resize", syncSticky);
    };
  }, [active, paperRef, scrollerRef]);

  useEffect(() => {
    const paper = paperRef.current;
    if (!editor || !paper) {
      return;
    }

    const syncSelected = () => {
      setSelected(toHover(selectedTopLevel(editor, paper)));
    };
    syncSelected();
    editor.on("selectionUpdate", syncSelected);
    editor.on("transaction", syncSelected);

    const onPointerMove = (event: PointerEvent) => {
      if (draggingRef.current || menuOpen) {
        return;
      }
      if (isFieldTarget(event.target)) {
        setHover(null);
        setInsertSlot(null);
        return;
      }
      const blocks = readTopLevelBlocks(editor, paper);
      const y = event.clientY - paper.getBoundingClientRect().top;
      const hit = hitTestBlocks(y, blocks, paper.getBoundingClientRect().height, readHitTestOptions(paper, pageSize));
      if (hit?.kind === "block") {
        setHover(toHover(hit.block));
        setInsertSlot(null);
        return;
      }
      setHover(null);
      if (hit?.kind === "gap" && isPageBackedSeamInsert(editor, hit.insertPos)) {
        setInsertSlot(null);
        return;
      }
      setInsertSlot(hit?.kind === "gap" ? { insertPos: hit.insertPos, topPx: hit.topPx } : null);
    };

    const onPointerLeave = (event: PointerEvent) => {
      if (draggingRef.current || menuOpen) {
        return;
      }
      if (containerRef.current?.contains(event.relatedTarget as Node)) {
        return;
      }
      setHover(null);
      setInsertSlot(null);
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }
      if (containerRef.current?.contains(event.target as Node)) {
        setDismissed(isGapTarget(event.target));
        return;
      }
      if (isFieldTarget(event.target)) {
        setDismissed(true);
        setHover(null);
        setInsertSlot(null);
        return;
      }
      const blocks = readTopLevelBlocks(editor, paper);
      const y = event.clientY - paper.getBoundingClientRect().top;
      const hit = hitTestBlocks(y, blocks, paper.getBoundingClientRect().height, readHitTestOptions(paper, pageSize));
      if (hit?.kind === "block") {
        setDismissed(false);
        return;
      }
      setDismissed(true);
      setHover(null);
      if (hit?.kind === "gap") {
        if (isPageBackedSeamInsert(editor, hit.insertPos)) {
          setInsertSlot(null);
          return;
        }
        event.preventDefault();
        setInsertSlot({ insertPos: hit.insertPos, topPx: hit.topPx });
        return;
      }
      setInsertSlot(null);
    };

    paper.addEventListener("pointermove", onPointerMove);
    paper.addEventListener("pointerleave", onPointerLeave);
    paper.addEventListener("pointerdown", onPointerDown, true);
    const scroller = paper.parentElement?.parentElement;
    const onScrollerDown = (event: PointerEvent) => {
      if (paper.contains(event.target as Node) || containerRef.current?.contains(event.target as Node)) {
        return;
      }
      setDismissed(true);
      setHover(null);
      setInsertSlot(null);
    };
    scroller?.addEventListener("pointerdown", onScrollerDown);

    return () => {
      editor.off("selectionUpdate", syncSelected);
      editor.off("transaction", syncSelected);
      paper.removeEventListener("pointermove", onPointerMove);
      paper.removeEventListener("pointerleave", onPointerLeave);
      paper.removeEventListener("pointerdown", onPointerDown, true);
      scroller?.removeEventListener("pointerdown", onScrollerDown);
    };
  }, [editor, menuOpen, paperRef, pageSize]);

  const startDrag = useCallback(
    (event: React.PointerEvent) => {
      const paper = paperRef.current;
      const sourceHover = hover ?? selectedChrome;
      if (!editor || !paper || !sourceHover || event.button !== 0) {
        return;
      }
      event.preventDefault();
      draggingRef.current = true;

      const sourcePos = sourceHover.pos;
      const blocks = readTopLevelBlocks(editor, paper);
      const source = blocks.find((block) => block.pos === sourcePos);
      if (!source) {
        draggingRef.current = false;
        return;
      }

      const boundaries = [
        ...blocks.map((block) => ({ index: block.index, y: block.top })),
        { index: editor.state.doc.childCount, y: blocks.at(-1)?.bottom ?? 0 },
      ];

      const onMove = (moveEvent: PointerEvent) => {
        const y = moveEvent.clientY - paper.getBoundingClientRect().top;
        const nearest = boundaries.reduce((best, candidate) =>
          Math.abs(candidate.y - y) < Math.abs(best.y - y) ? candidate : best,
        );
        setDropTarget({ index: nearest.index, topPx: nearest.y });
      };

      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        draggingRef.current = false;

        setDropTarget((target) => {
          if (target) {
            moveBlock(editor, sourcePos, target.index);
          }
          return null;
        });
        setHover(null);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [editor, hover, paperRef, selectedChrome],
  );

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setAddMenuOpen(false);
        setGearMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  if (!editor) {
    return null;
  }

  const showGap = Boolean(insertSlot) && !active;

  if (!active && !showGap && !dropTarget) {
    return null;
  }

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 z-[25]">
      {dropTarget ? (
        <div
          className="pointer-events-none absolute left-6 right-6 z-30 h-0.5 rounded bg-primary"
          style={{ top: dropTarget.topPx }}
          aria-hidden
        />
      ) : null}

      {showGap && insertSlot ? (
        <div
          data-creator-insert-gap
          className="creator-insert-gap pointer-events-none"
          style={{ top: insertSlot.topPx }}
        >
          <div className="creator-insert-line" aria-hidden />
          <div className="creator-insert-plus pointer-events-auto">
            <button
              type="button"
              onClick={() => {
                setGearMenuOpen(false);
                setDismissed(true);
                setAddMenuSource("gap");
                setAddMenuOpen((open) => !open);
              }}
              aria-label="Add element"
              title="Add element"
              aria-expanded={addMenuOpen && addMenuSource === "gap"}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm hover:border-slate-400 hover:text-foreground"
            >
              <IconPlus className="h-3.5 w-3.5" />
            </button>
            {addMenuOpen && addMenuSource === "gap" ? (
              <div className="absolute left-0 top-8 z-40">
                <ElementMenu
                  editor={editor}
                  insertPos={insertSlot.insertPos}
                  onOpenLibrary={() => {
                    setAddMenuOpen(false);
                    chrome.openLibrary();
                  }}
                  onDone={() => {
                    setAddMenuOpen(false);
                    setInsertSlot(null);
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {active ? (
        <div
          className="pointer-events-none absolute left-0 right-0"
          style={{ top: active.topPx, height: Math.max(24, active.heightPx) }}
        >
          <div
            className={`creator-block-frame${selectedChrome?.pos === active.pos ? " is-selected" : ""}`}
            aria-hidden
          />

          <div
            className="creator-block-handle pointer-events-auto"
            style={{ top: stickyOffsetPx }}
          >
            <button
              type="button"
              onPointerDown={startDrag}
              aria-label="Drag to move"
              title="Drag to move"
              className="flex h-6 w-6 cursor-grab items-center justify-center rounded border border-border bg-surface text-muted shadow-sm hover:text-foreground active:cursor-grabbing"
            >
              <IconDragHandle className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="creator-block-add-below pointer-events-auto">
            <button
              type="button"
              onClick={() => {
                setGearMenuOpen(false);
                setAddMenuSource("below");
                setAddMenuOpen((open) => !(open && addMenuSource === "below"));
              }}
              aria-label="Add Text Block below"
              title="Add below"
              aria-expanded={addMenuOpen && addMenuSource === "below"}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 shadow-sm hover:border-primary hover:text-primary"
            >
              <IconPlus className="h-3.5 w-3.5" />
            </button>
            {addMenuOpen && addMenuSource === "below" ? (
              <div className="absolute left-0 top-8 z-40">
                <ElementMenu
                  editor={editor}
                  insertPos={(() => {
                    const node = editor.state.doc.nodeAt(active.pos);
                    return node ? active.pos + node.nodeSize : active.pos;
                  })()}
                  onOpenLibrary={() => {
                    setAddMenuOpen(false);
                    chrome.openLibrary();
                  }}
                  onDone={() => setAddMenuOpen(false)}
                />
              </div>
            ) : null}
          </div>

          <div
            className="creator-block-gear pointer-events-auto"
            style={{ top: stickyOffsetPx }}
          >
            <button
              type="button"
              onClick={() => {
                setAddMenuOpen(false);
                setDismissed(false);
                setHover((current) => current ?? selected);
                setGearMenuOpen((open) => !open);
              }}
              aria-label="Element options"
              title="Element options"
              aria-expanded={gearMenuOpen}
              aria-haspopup="menu"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm hover:opacity-95"
            >
              <IconGear className="h-3.5 w-3.5" />
            </button>
            {gearMenuOpen ? (
              <div className="absolute right-0 top-9 z-40">
                <BlockOptionsMenu
                  editor={editor}
                  pos={active.pos}
                  documentId={documentId}
                  templateId={templateId}
                  onClose={() => setGearMenuOpen(false)}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Lifts a top-level node out of the flow and drops it before `targetIndex`. */
function moveBlock(editor: Editor, sourcePos: number, targetIndex: number): void {
  const { state, dispatch } = editor.view;
  const node = state.doc.nodeAt(sourcePos);
  if (!node) {
    return;
  }

  const offsets: number[] = [];
  let running = 0;
  state.doc.forEach((child) => {
    offsets.push(running);
    running += child.nodeSize;
  });
  offsets.push(running);

  const insertAt = offsets[Math.min(targetIndex, offsets.length - 1)] ?? running;
  if (insertAt === sourcePos || insertAt === sourcePos + node.nodeSize) {
    return;
  }

  const tr = state.tr.delete(sourcePos, sourcePos + node.nodeSize);
  tr.insert(tr.mapping.map(insertAt), node);
  dispatch(tr.scrollIntoView());
}
