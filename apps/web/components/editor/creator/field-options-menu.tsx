"use client";

import type { Editor } from "@tiptap/core";
import { useEffect, useRef } from "react";
import { IconDuplicate, IconTrash } from "./creator-icons";

type Props = {
  editor: Editor;
  getPos: () => number | undefined;
  onClose: () => void;
};

export function FieldOptionsMenu({ editor, getPos, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  function currentRange(): { from: number; to: number } | null {
    const pos = getPos();
    if (typeof pos !== "number") {
      return null;
    }
    const node = editor.state.doc.nodeAt(pos);
    if (!node) {
      return null;
    }
    return { from: pos, to: pos + node.nodeSize };
  }

  function duplicate() {
    const pos = getPos();
    if (typeof pos !== "number") {
      return;
    }
    const node = editor.state.doc.nodeAt(pos);
    if (!node) {
      return;
    }
    const json = node.toJSON() as { type: string; attrs?: Record<string, unknown> };
    editor
      .chain()
      .focus()
      .insertContentAt(pos + node.nodeSize, {
        ...json,
        attrs: {
          ...(json.attrs ?? {}),
          fieldId: `field-${globalThis.crypto.randomUUID()}`,
        },
      })
      .run();
    onClose();
  }

  function remove() {
    const range = currentRange();
    if (!range) {
      return;
    }
    editor.chain().focus().deleteRange(range).run();
    onClose();
  }

  return (
    <div
      ref={menuRef}
      role="menu"
      className="w-44 overflow-hidden rounded-lg border border-border bg-surface py-1 text-sm text-foreground shadow-xl"
    >
      <button
        type="button"
        role="menuitem"
        onClick={duplicate}
        className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-slate-50"
      >
        <IconDuplicate className="h-4 w-4 shrink-0 text-slate-600" />
        Duplicate
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={remove}
        className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-slate-50"
      >
        <IconTrash className="h-4 w-4 shrink-0 text-slate-600" />
        Delete
      </button>
    </div>
  );
}
