"use client";

import type { Editor } from "@tiptap/core";
import { useEffect, useMemo, useState } from "react";
import {
  firstTextFromNode,
  insertLibraryDoc,
  LIBRARY_CATEGORIES,
  libraryCategoryLabel,
  resolveLibraryCategory,
  type LibraryCategoryId,
} from "@/lib/editor/library-blocks";
import type { EditorDoc } from "@/lib/editor/types";
import { IconClose, IconLibrary } from "./creator-icons";

type LibraryItem = {
  id: string;
  name: string;
  block_type: string;
  editor_json: EditorDoc;
};

type Props = {
  editor: Editor | null;
  open: boolean;
  onClose: () => void;
};

type TabId = "all" | LibraryCategoryId;

export function ContentLibraryModal({ editor, open, onClose }: Props) {
  const [blocks, setBlocks] = useState<LibraryItem[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<TabId>("all");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) {
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void fetch("/api/content-blocks?limit=200", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Could not load the content library");
        }
        const payload = (await response.json()) as { blocks: LibraryItem[] };
        setBlocks(payload.blocks ?? []);
      })
      .catch((loadError: unknown) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") {
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Could not load the content library");
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [open]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return blocks.filter((block) => {
      if (tab !== "all" && resolveLibraryCategory(block.block_type) !== tab) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const snippet = firstTextFromNode(block.editor_json.content?.[0]).toLowerCase();
      return (
        block.name.toLowerCase().includes(needle) ||
        libraryCategoryLabel(resolveLibraryCategory(block.block_type)).toLowerCase().includes(needle) ||
        snippet.includes(needle)
      );
    });
  }, [blocks, query, tab]);

  if (!open) {
    return null;
  }

  function insert(block: LibraryItem) {
    if (!editor) {
      return;
    }
    insertLibraryDoc(editor, block.editor_json);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/40 p-4 pt-16" role="presentation">
      <div
        role="dialog"
        aria-labelledby="content-library-title"
        className="flex max-h-[min(36rem,calc(100vh-6rem))] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <IconLibrary className="h-4 w-4 text-primary" />
            <h2 id="content-library-title" className="text-sm font-semibold text-foreground">
              Content library
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted hover:bg-slate-100 hover:text-foreground"
            aria-label="Close content library"
          >
            <IconClose />
          </button>
        </div>

        <div className="border-b border-border px-4 py-3">
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search saved text, images, videos, and tables"
            aria-label="Search content library"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none ring-primary/15 focus:ring-2"
          />
          <div className="mt-3 flex flex-wrap gap-1.5">
            <TabButton active={tab === "all"} onClick={() => setTab("all")}>
              All
            </TabButton>
            {LIBRARY_CATEGORIES.map((category) => (
              <TabButton
                key={category.id}
                active={tab === category.id}
                onClick={() => setTab(category.id)}
              >
                {category.label}
              </TabButton>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {loading ? <p className="px-2 py-6 text-center text-sm text-muted">Loading library…</p> : null}
          {error ? <p className="px-2 py-6 text-center text-sm text-red-600">{error}</p> : null}
          {!loading && !error && visible.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted">
              {query.trim()
                ? "No matching items. Try another search."
                : "Nothing saved yet. Use the gear menu on an element to add it here."}
            </p>
          ) : null}
          <ul className="grid gap-2 sm:grid-cols-2">
            {visible.map((block) => {
              const snippet = firstTextFromNode(block.editor_json.content?.[0]).replace(/\s+/g, " ").trim();
              return (
                <li key={block.id}>
                  <button
                    type="button"
                    onClick={() => insert(block)}
                    className="flex h-full w-full flex-col rounded-lg border border-border bg-background p-3 text-left hover:border-primary/40 hover:bg-slate-50"
                  >
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                      {libraryCategoryLabel(resolveLibraryCategory(block.block_type))}
                    </span>
                    <span className="mt-1 truncate text-sm font-medium text-foreground">{block.name}</span>
                    {snippet ? (
                      <span className="mt-1 line-clamp-2 text-xs text-muted">{snippet}</span>
                    ) : (
                      <span className="mt-1 text-xs text-muted">Insert this saved element</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
      <button type="button" className="absolute inset-0 -z-10 cursor-default" aria-label="Dismiss" onClick={onClose} />
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? "bg-primary text-primary-foreground" : "bg-slate-100 text-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
