"use client";

import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";
import { useEditorEventTick } from "@/components/editor/hooks/use-editor-event-tick";
import { IconColumnPlus, IconRowPlus, IconTrash } from "./creator-icons";

type Props = {
  editor: Editor | null;
  paperRef: React.RefObject<HTMLDivElement | null>;
};

type ToolbarPos = { top: number; left: number };

/**
 * Contextual table controls only. Regular text formatting lives on the
 * persistent toolbar so this bubble does not replace Google Docs-style chrome.
 */
export function CreatorSelectionToolbar({ editor, paperRef }: Props) {
  const tick = useEditorEventTick(editor);
  const [pos, setPos] = useState<ToolbarPos | null>(null);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const sync = () => {
      const paper = paperRef.current;
      if (!paper || !editor.isActive("table")) {
        setPos(null);
        return;
      }
      const { from } = editor.state.selection;
      const coords = editor.view.coordsAtPos(from);
      const paperRect = paper.getBoundingClientRect();
      setPos({
        top: Math.max(8, coords.top - paperRect.top - 44),
        left: Math.min(paperRect.width - 240, Math.max(8, coords.left - paperRect.left)),
      });
    };
    editor.on("selectionUpdate", sync);
    editor.on("update", sync);
    sync();
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("update", sync);
    };
  }, [editor, paperRef]);

  if (!editor || !pos || !editor.isActive("table")) {
    return null;
  }
  void tick;

  return (
    <div
      className="creator-selection-toolbar absolute z-30 flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-surface px-1 py-1 shadow-md"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <MarkButton label="Add row" onClick={() => editor.chain().focus().addRowAfter().run()}>
        <IconRowPlus className="h-3.5 w-3.5" />
      </MarkButton>
      <MarkButton label="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()}>
        <IconColumnPlus className="h-3.5 w-3.5" />
      </MarkButton>
      <MarkButton label="Delete row" onClick={() => editor.chain().focus().deleteRow().run()}>
        −R
      </MarkButton>
      <MarkButton label="Delete column" onClick={() => editor.chain().focus().deleteColumn().run()}>
        −C
      </MarkButton>
      <MarkButton label="Delete table" onClick={() => editor.chain().focus().deleteTable().run()}>
        <IconTrash className="h-3.5 w-3.5" />
      </MarkButton>
    </div>
  );
}

function MarkButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="rounded p-1 text-muted hover:bg-slate-100 hover:text-foreground"
    >
      {children}
    </button>
  );
}
