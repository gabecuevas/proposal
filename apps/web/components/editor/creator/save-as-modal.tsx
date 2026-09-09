"use client";

import { useEffect, useRef, useState } from "react";
import { IconClose } from "./creator-icons";

type Props = {
  open: boolean;
  kind?: "document" | "template";
  initialName: string;
  saving?: boolean;
  error?: string;
  onClose: () => void;
  onSave: (name: string) => void | Promise<void>;
};

export function SaveAsModal({
  open,
  kind = "document",
  initialName,
  saving = false,
  error = "",
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  const noun = kind === "template" ? "template" : "document";

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(initialName);
    const id = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 20);
    return () => window.clearTimeout(id);
  }, [initialName, open]);

  if (!open) {
    return null;
  }

  function submit() {
    const next = name.trim();
    if (!next || saving) {
      return;
    }
    void onSave(next);
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/40 p-4 pt-24"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="save-as-title"
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="save-as-title" className="text-sm font-semibold text-foreground">
            Save as
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1 text-muted hover:bg-slate-100 hover:text-foreground disabled:opacity-40"
            aria-label="Close save as"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
        <form
          className="px-4 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <label className="block text-xs font-medium text-muted" htmlFor="save-as-name">
            {kind === "template" ? "Template name" : "Document name"}
          </label>
          <input
            id="save-as-name"
            ref={inputRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && !saving) {
                onClose();
              }
            }}
            placeholder={`Untitled ${noun}`}
            className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary/15 focus:ring-2"
          />
          <p className="mt-2 text-xs text-muted">This updates the {noun} title. Content stays the same.</p>
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-slate-50 disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
