"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useEffect, useState } from "react";
import { collectHeadings, type TocEntry } from "@/lib/editor/extensions/table-of-contents";
import type { EditorDoc } from "@/lib/editor/types";

export function TableOfContentsView({ node, editor, selected }: NodeViewProps) {
  const title = String(node.attrs.title ?? "Table of contents");
  const maxLevel = Number(node.attrs.maxLevel ?? 3);
  const [entries, setEntries] = useState<TocEntry[]>([]);

  useEffect(() => {
    const refresh = () => {
      setEntries(collectHeadings(editor.getJSON() as EditorDoc, maxLevel));
    };
    refresh();
    editor.on("update", refresh);
    return () => {
      editor.off("update", refresh);
    };
  }, [editor, maxLevel]);

  return (
    <NodeViewWrapper
      className={`creator-toc my-4 rounded-md border px-4 py-3 ${
        selected ? "border-primary bg-primary/[0.04]" : "border-slate-200 bg-slate-50/60"
      }`}
      contentEditable={false}
    >
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">Add headings to build the table of contents.</p>
      ) : (
        <ol className="space-y-1">
          {entries.map((entry) => (
            <li
              key={entry.id}
              style={{ paddingLeft: `${(entry.level - 1) * 16}px` }}
              className="flex items-baseline gap-2 text-sm text-slate-700"
            >
              <span className="truncate">{entry.text}</span>
              <span className="min-w-4 flex-1 border-b border-dotted border-slate-300" />
            </li>
          ))}
        </ol>
      )}
    </NodeViewWrapper>
  );
}
