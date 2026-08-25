"use client";

import type { Editor } from "@tiptap/core";
import { useEffect, useState, type ReactElement } from "react";
import { setBlockClipboard } from "@/lib/editor/block-clipboard";
import {
  defaultLibraryName,
  deleteNodeAt,
  duplicateNodeAt,
  libraryCategoryForType,
  libraryCategoryLabel,
  replaceNodeContentWithText,
  sliceNodeToDoc,
  updateNodeAttrs,
} from "@/lib/editor/library-blocks";
import type { EditorNode } from "@/lib/editor/types";
import {
  IconComment,
  IconCopy,
  IconCut,
  IconDuplicate,
  IconLibrary,
  IconLock,
  IconPalette,
  IconSparkle,
  IconTrash,
} from "./creator-icons";

type View = "root" | "ai" | "comment" | "design";

type Props = {
  editor: Editor;
  pos: number;
  documentId?: string;
  templateId?: string;
  onClose: () => void;
};

const DESIGNS = [
  { id: "default", label: "Default" },
  { id: "highlight", label: "Highlight" },
  { id: "muted", label: "Muted" },
] as const;

export function BlockOptionsMenu({ editor, pos, documentId, templateId, onClose }: Props) {
  const node = editor.state.doc.nodeAt(pos);
  const json = (node?.toJSON() ?? null) as EditorNode | null;
  const [view, setView] = useState<View>("root");
  const [name, setName] = useState(() => {
    const stored = typeof node?.attrs.blockName === "string" ? node.attrs.blockName : "";
    return stored || (json ? defaultLibraryName(json) : "");
  });
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("Rewrite this more clearly for a proposal.");
  const [comment, setComment] = useState("");
  const shortcut = typeof navigator !== "undefined" && /Mac/i.test(navigator.platform) ? "⌘" : "Ctrl";

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!node || !json) {
    return null;
  }

  const block = json;
  const locked = node.attrs.locked === true;
  const design = typeof node.attrs.blockDesign === "string" ? node.attrs.blockDesign : "default";
  const isText = libraryCategoryForType(node.type.name) === "text";

  function copy() {
    setBlockClipboard(block);
    setStatus("Copied");
  }

  function cut() {
    setBlockClipboard(block);
    deleteNodeAt(editor, pos);
    onClose();
  }

  function duplicate() {
    duplicateNodeAt(editor, pos);
    onClose();
  }

  function remove() {
    deleteNodeAt(editor, pos);
    onClose();
  }

  async function saveToLibrary() {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/content-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || defaultLibraryName(block),
          block_type: libraryCategoryForType(block.type),
          editor_json: sliceNodeToDoc(block),
        }),
      });
      if (!response.ok) {
        throw new Error("Could not save to the content library");
      }
      updateNodeAttrs(editor, pos, { blockName: name.trim() });
      setStatus("Saved to content library");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function rewriteWithAi() {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "section_rewrite",
          prompt: `${aiPrompt}\n\n${defaultLibraryName(block)}`,
          documentId: documentId || undefined,
          templateId: templateId || undefined,
        }),
      });
      const payload = (await response.json()) as { result?: { output?: string }; error?: { message?: string } };
      if (!response.ok) {
        throw new Error(payload.error?.message ?? "AI rewrite failed");
      }
      const output = payload.result?.output?.trim();
      if (!output) {
        throw new Error("AI returned an empty rewrite");
      }
      replaceNodeContentWithText(editor, pos, output);
      onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "AI rewrite failed");
    } finally {
      setBusy(false);
    }
  }

  async function addComment() {
    if (!documentId) {
      setStatus("Comments are available on documents.");
      return;
    }
    const message = comment.trim();
    if (!message) {
      setStatus("Write a comment first.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch(`/api/documents/${documentId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!response.ok) {
        throw new Error("Could not add comment");
      }
      setStatus("Comment added");
      setComment("");
      setView("root");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not add comment");
    } finally {
      setBusy(false);
    }
  }

  if (view === "ai") {
    return (
      <MenuShell>
        <SubHeader title="Edit with AI" onBack={() => setView("root")} />
        <textarea
          value={aiPrompt}
          onChange={(event) => setAiPrompt(event.target.value)}
          className="mb-2 h-20 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none ring-primary/15 focus:ring-2"
          aria-label="AI instructions"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void rewriteWithAi()}
          className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Rewriting…" : "Rewrite block"}
        </button>
        {status ? <p className="mt-2 text-xs text-muted">{status}</p> : null}
      </MenuShell>
    );
  }

  if (view === "comment") {
    return (
      <MenuShell>
        <SubHeader title="Add a comment" onBack={() => setView("root")} />
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Leave a note on this document"
          className="mb-2 h-20 w-full resize-none rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none ring-primary/15 focus:ring-2"
          aria-label="Comment"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void addComment()}
          className="w-full rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Saving…" : "Add comment"}
        </button>
        {status ? <p className="mt-2 text-xs text-muted">{status}</p> : null}
      </MenuShell>
    );
  }

  if (view === "design") {
    return (
      <MenuShell>
        <SubHeader title="Text block design" onBack={() => setView("root")} />
        {DESIGNS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => updateNodeAttrs(editor, pos, { blockDesign: option.id })}
            className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm ${
              design === option.id ? "bg-primary/10 text-primary" : "hover:bg-slate-50"
            }`}
          >
            {option.label}
            {design === option.id ? <span className="text-xs">Selected</span> : null}
          </button>
        ))}
      </MenuShell>
    );
  }

  return (
    <MenuShell>
      {isText ? (
        <MenuRow Icon={IconSparkle} label="Edit with AI" onClick={() => setView("ai")} />
      ) : null}
      <MenuRow
        Icon={IconLibrary}
        label="Add to content library"
        onClick={() => void saveToLibrary()}
        disabled={busy}
      />
      <Divider />
      <MenuRow Icon={IconCopy} label="Copy" shortcut={`${shortcut}+C`} onClick={copy} />
      <MenuRow Icon={IconCut} label="Cut" shortcut={`${shortcut}+X`} onClick={cut} />
      <MenuRow Icon={IconDuplicate} label="Duplicate" onClick={duplicate} />
      <Divider />
      <MenuRow Icon={IconComment} label="Add a comment" onClick={() => setView("comment")} />
      <Divider />
      <MenuRow Icon={IconPalette} label="Text block design" onClick={() => setView("design")} />
      <MenuRow
        Icon={IconLock}
        label="Content locking"
        hint={locked ? "Locked" : "Unlocked"}
        onClick={() => updateNodeAttrs(editor, pos, { locked: !locked })}
      />
      <Divider />
      <MenuRow Icon={IconTrash} label="Delete" onClick={remove} />
      <Divider />
      <label className="mt-1 block px-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
        {libraryCategoryLabel(libraryCategoryForType(block.type))} name
      </label>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onBlur={() => updateNodeAttrs(editor, pos, { blockName: name.trim() })}
        placeholder="Text name"
        aria-label="Element name"
        className="mx-2 mb-1 mt-1 w-[calc(100%-1rem)] rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none ring-primary/15 focus:ring-2"
      />
      {status ? <p className="px-2 pb-1 text-xs text-muted">{status}</p> : null}
    </MenuShell>
  );
}

function MenuShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="menu"
      className="w-64 overflow-hidden rounded-lg border border-border bg-surface py-1 text-sm text-foreground shadow-xl"
    >
      {children}
    </div>
  );
}

function Divider() {
  return <div className="my-1 border-t border-border" />;
}

function SubHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-2 pt-1">
      <button type="button" onClick={onBack} className="rounded px-1 text-muted hover:bg-slate-100" aria-label="Back">
        ‹
      </button>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{title}</p>
    </div>
  );
}

function MenuRow({
  Icon,
  label,
  shortcut,
  hint,
  onClick,
  disabled,
}: {
  Icon: (props: { className?: string }) => ReactElement;
  label: string;
  shortcut?: string;
  hint?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left hover:bg-slate-50 disabled:opacity-50"
    >
      <Icon className="h-4 w-4 shrink-0 text-slate-600" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint ? <span className="text-[11px] text-muted">{hint}</span> : null}
      {shortcut ? <span className="text-[11px] text-muted">{shortcut}</span> : null}
    </button>
  );
}
