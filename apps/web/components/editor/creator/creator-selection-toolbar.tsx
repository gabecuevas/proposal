"use client";

import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";
import { FONT_SIZES } from "@/lib/editor/extensions/font-size";
import {
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconBold,
  IconColumnPlus,
  IconItalic,
  IconRowPlus,
  IconTrash,
  IconUnderline,
} from "./creator-icons";

type Props = {
  editor: Editor | null;
  paperRef: React.RefObject<HTMLDivElement | null>;
};

type ToolbarPos = { top: number; left: number };

export function CreatorSelectionToolbar({ editor, paperRef }: Props) {
  const [pos, setPos] = useState<ToolbarPos | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const sync = () => {
      setTick((n) => n + 1);
      const paper = paperRef.current;
      const { empty, from, to } = editor.state.selection;
      const inTable = editor.isActive("table");
      if (!paper || (empty && !inTable)) {
        setPos(null);
        return;
      }
      const coords = editor.view.coordsAtPos(empty ? from : Math.floor((from + to) / 2));
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

  if (!editor || !pos) {
    return null;
  }

  const inTable = editor.isActive("table");
  void tick;

  return (
    <div
      className="creator-selection-toolbar absolute z-30 flex flex-wrap items-center gap-0.5 rounded-md border border-border bg-surface px-1 py-1 shadow-md"
      style={{ top: pos.top, left: pos.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <MarkButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <IconBold className="h-3.5 w-3.5" />
      </MarkButton>
      <MarkButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <IconItalic className="h-3.5 w-3.5" />
      </MarkButton>
      <MarkButton
        label="Underline"
        active={editor.isActive("underline")}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <IconUnderline className="h-3.5 w-3.5" />
      </MarkButton>
      <span className="mx-0.5 h-4 w-px bg-border" />
      <MarkButton
        label="Align left"
        active={editor.isActive({ textAlign: "left" })}
        onClick={() => editor.chain().focus().setTextAlign("left").run()}
      >
        <IconAlignLeft className="h-3.5 w-3.5" />
      </MarkButton>
      <MarkButton
        label="Align center"
        active={editor.isActive({ textAlign: "center" })}
        onClick={() => editor.chain().focus().setTextAlign("center").run()}
      >
        <IconAlignCenter className="h-3.5 w-3.5" />
      </MarkButton>
      <MarkButton
        label="Align right"
        active={editor.isActive({ textAlign: "right" })}
        onClick={() => editor.chain().focus().setTextAlign("right").run()}
      >
        <IconAlignRight className="h-3.5 w-3.5" />
      </MarkButton>
      <label className="sr-only" htmlFor="creator-font-size">
        Font size
      </label>
      <select
        id="creator-font-size"
        className="ml-0.5 rounded border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-muted hover:border-border"
        value={String(editor.getAttributes("textStyle").fontSize ?? "")}
        onChange={(event) => {
          const size = event.target.value;
          if (size) {
            editor.chain().focus().setFontSize(size).run();
          } else {
            editor.chain().focus().unsetFontSize().run();
          }
        }}
      >
        <option value="">Size</option>
        {FONT_SIZES.map((size) => (
          <option key={size} value={size}>
            {size.replace("px", "")}
          </option>
        ))}
      </select>

      {inTable ? (
        <>
          <span className="mx-0.5 h-4 w-px bg-border" />
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
        </>
      ) : null}
    </div>
  );
}

function MarkButton({
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
