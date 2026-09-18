"use client";

import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  distributeFlowTableColumns,
  isInFlowTable,
  openFlowTableOptionsEvent,
} from "@/lib/flow-document/table-commands";

type MenuState = {
  x: number;
  y: number;
} | null;

type Props = {
  editor: Editor | null;
  locked?: boolean;
};

const MENU_WIDTH = 240;
const MENU_ESTIMATED_HEIGHT = 420;

function clampMenuPosition(clientX: number, clientY: number): { x: number; y: number } {
  const pad = 8;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = Math.min(Math.max(pad, clientX), Math.max(pad, vw - MENU_WIDTH - pad));
  const y = Math.min(Math.max(pad, clientY), Math.max(pad, vh - MENU_ESTIMATED_HEIGHT - pad));
  return { x, y };
}

/**
 * Google Docs–style right-click table menu.
 * Portaled to document.body so zoom `transform: scale(...)` on the paper
 * stage cannot offset `position: fixed` coordinates.
 */
export function FlowTableContextMenu({ editor, locked }: Props) {
  const [menu, setMenu] = useState<MenuState>(null);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const dom = editor.view.dom;

    function onContextMenu(event: MouseEvent) {
      if (locked || !editor) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (!target?.closest("table, td, th")) {
        setMenu(null);
        return;
      }
      // Place the caret from click coords so we never select the tableCell node itself
      // (TextSelection into a non-inline cell node throws and can crash the view).
      const coords = editor.view.posAtCoords({ left: event.clientX, top: event.clientY });
      if (coords) {
        try {
          editor.chain().focus().setTextSelection(coords.pos).run();
        } catch {
          editor.chain().focus().run();
        }
      }
      if (!isInFlowTable(editor)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setMenu(clampMenuPosition(event.clientX, event.clientY));
    }

    function onClose() {
      setMenu(null);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenu(null);
      }
    }

    dom.addEventListener("contextmenu", onContextMenu);
    window.addEventListener("click", onClose);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      dom.removeEventListener("contextmenu", onContextMenu);
      window.removeEventListener("click", onClose);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [editor, locked]);

  if (!menu || !editor || typeof document === "undefined") {
    return null;
  }

  function run(action: () => void) {
    action();
    setMenu(null);
  }

  return createPortal(
    <div
      className="flow-table-context-menu"
      style={{ left: menu.x, top: menu.y }}
      role="menu"
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
    >
      <button type="button" role="menuitem" onClick={() => run(() => editor.chain().focus().addRowBefore().run())}>
        Insert row above
      </button>
      <button type="button" role="menuitem" onClick={() => run(() => editor.chain().focus().addRowAfter().run())}>
        Insert row below
      </button>
      <button type="button" role="menuitem" onClick={() => run(() => editor.chain().focus().addColumnBefore().run())}>
        Insert column left
      </button>
      <button type="button" role="menuitem" onClick={() => run(() => editor.chain().focus().addColumnAfter().run())}>
        Insert column right
      </button>
      <div className="flow-table-context-sep" />
      <button type="button" role="menuitem" onClick={() => run(() => editor.chain().focus().deleteRow().run())}>
        Delete row
      </button>
      <button type="button" role="menuitem" onClick={() => run(() => editor.chain().focus().deleteColumn().run())}>
        Delete column
      </button>
      <button type="button" role="menuitem" onClick={() => run(() => editor.chain().focus().deleteTable().run())}>
        Delete table
      </button>
      <div className="flow-table-context-sep" />
      <button type="button" role="menuitem" onClick={() => run(() => editor.chain().focus().mergeCells().run())}>
        Merge cells
      </button>
      <button type="button" role="menuitem" onClick={() => run(() => editor.chain().focus().splitCell().run())}>
        Split cell
      </button>
      <button type="button" role="menuitem" onClick={() => run(() => distributeFlowTableColumns(editor))}>
        Distribute columns
      </button>
      <div className="flow-table-context-sep" />
      <button
        type="button"
        role="menuitem"
        onClick={() =>
          run(() => {
            openFlowTableOptionsEvent();
          })
        }
      >
        Table options
      </button>
    </div>,
    document.body,
  );
}
