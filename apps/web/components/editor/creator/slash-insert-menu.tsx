"use client";

import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";
import { ElementMenu } from "./element-menu";

type SlashState = { query: string; from: number; to: number; top: number; left: number };

type Props = {
  editor: Editor | null;
  paperRef: React.RefObject<HTMLDivElement | null>;
};

function readSlash(editor: Editor, paper: HTMLElement): SlashState | null {
  const { $from, empty } = editor.state.selection;
  if (!empty || $from.parent.type.name !== "paragraph") {
    return null;
  }
  const text = $from.parent.textContent;
  if (!text.startsWith("/")) {
    return null;
  }
  const query = text.slice(1);
  if (query.includes("\n") || query.length > 32) {
    return null;
  }
  const start = $from.start();
  const coords = editor.view.coordsAtPos($from.pos);
  const paperRect = paper.getBoundingClientRect();
  return {
    query,
    from: start,
    to: start + text.length,
    top: coords.bottom - paperRect.top + 6,
    left: Math.max(0, coords.left - paperRect.left),
  };
}

/** Opens when the current paragraph is `/` plus an optional filter. */
export function SlashInsertMenu({ editor, paperRef }: Props) {
  const [slash, setSlash] = useState<SlashState | null>(null);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const sync = () => {
      const paper = paperRef.current;
      setSlash(paper ? readSlash(editor, paper) : null);
    };
    editor.on("selectionUpdate", sync);
    editor.on("update", sync);
    sync();
    return () => {
      editor.off("selectionUpdate", sync);
      editor.off("update", sync);
    };
  }, [editor, paperRef]);

  useEffect(() => {
    if (!slash || !editor) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSlash(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [editor, slash]);

  if (!editor || !slash) {
    return null;
  }

  return (
    <div className="absolute z-40" style={{ top: slash.top, left: slash.left }}>
      <ElementMenu
        editor={editor}
        query={slash.query}
        onBeforeInsert={() => {
          editor.chain().focus().deleteRange({ from: slash.from, to: slash.to }).run();
        }}
        onDone={() => setSlash(null)}
      />
    </div>
  );
}
