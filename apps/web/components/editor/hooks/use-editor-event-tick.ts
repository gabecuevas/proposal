"use client";

import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";

/** Local subscription so toolbar/menus update without rerendering the document page. */
export function useEditorEventTick(editor: Editor | null): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const bump = () => setTick((n) => n + 1);
    editor.on("selectionUpdate", bump);
    editor.on("transaction", bump);
    return () => {
      editor.off("selectionUpdate", bump);
      editor.off("transaction", bump);
    };
  }, [editor]);

  return tick;
}
