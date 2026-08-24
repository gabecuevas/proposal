"use client";

import type { Editor } from "@tiptap/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { ElementMenu } from "./element-menu";
import { IconDragHandle, IconPlus } from "./creator-icons";

/** Nodes that are not part of the reorderable flow. */
const PINNED_NODES = new Set(["fieldOverlay"]);

type HoverTarget = { pos: number; topPx: number };
type DropTarget = { index: number; topPx: number };

type Props = {
  editor: Editor | null;
  /** The paper element the handles are positioned against. */
  paperRef: React.RefObject<HTMLDivElement | null>;
};

type TopLevelBlock = { index: number; pos: number; size: number; top: number; bottom: number };

function readTopLevelBlocks(editor: Editor, paper: HTMLElement): TopLevelBlock[] {
  const paperTop = paper.getBoundingClientRect().top;
  const blocks: TopLevelBlock[] = [];
  let pos = 0;
  editor.state.doc.forEach((node, offset, index) => {
    pos = offset;
    if (!PINNED_NODES.has(node.type.name)) {
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
    }
  });
  void pos;
  return blocks;
}

export function CreatorBlockControls({ editor, paperRef }: Props) {
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const draggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const paper = paperRef.current;
    if (!editor || !paper) {
      return;
    }

    const onPointerMove = (event: PointerEvent) => {
      if (draggingRef.current || menuOpen) {
        return;
      }
      const blocks = readTopLevelBlocks(editor, paper);
      const y = event.clientY - paper.getBoundingClientRect().top;
      const match = blocks.find((block) => y >= block.top - 4 && y <= block.bottom + 4);
      setHover(match ? { pos: match.pos, topPx: match.top } : null);
    };

    const onPointerLeave = () => {
      if (!draggingRef.current && !menuOpen) {
        setHover(null);
      }
    };

    paper.addEventListener("pointermove", onPointerMove);
    paper.addEventListener("pointerleave", onPointerLeave);
    return () => {
      paper.removeEventListener("pointermove", onPointerMove);
      paper.removeEventListener("pointerleave", onPointerLeave);
    };
  }, [editor, menuOpen, paperRef]);

  const startDrag = useCallback(
    (event: React.PointerEvent) => {
      const paper = paperRef.current;
      if (!editor || !paper || !hover || event.button !== 0) {
        return;
      }
      event.preventDefault();
      draggingRef.current = true;

      const sourcePos = hover.pos;
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
    [editor, hover, paperRef],
  );

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  if (!editor) {
    return null;
  }

  return (
    <>
      {dropTarget ? (
        <div
          className="pointer-events-none absolute left-6 right-6 z-30 h-0.5 rounded bg-primary"
          style={{ top: dropTarget.topPx }}
          aria-hidden
        />
      ) : null}

      {hover ? (
        <div
          ref={containerRef}
          className="creator-block-handle"
          style={{ top: hover.topPx, left: 0 }}
        >
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Add element"
            title="Add element"
            aria-expanded={menuOpen}
            className="flex h-6 w-6 items-center justify-center rounded border border-border bg-surface text-muted shadow-sm hover:text-foreground"
          >
            <IconPlus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onPointerDown={startDrag}
            aria-label="Drag to move"
            title="Drag to move"
            className="flex h-6 w-6 cursor-grab items-center justify-center rounded border border-border bg-surface text-muted shadow-sm hover:text-foreground active:cursor-grabbing"
          >
            <IconDragHandle className="h-3.5 w-3.5" />
          </button>

          {menuOpen ? (
            <div className="absolute left-0 top-8 z-40">
              <ElementMenu
                editor={editor}
                onDone={() => setMenuOpen(false)}
                onBeforeInsert={() => {
                  const node = editor.state.doc.nodeAt(hover.pos);
                  if (node) {
                    editor.commands.focus(hover.pos + node.nodeSize - 1);
                  }
                }}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </>
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
