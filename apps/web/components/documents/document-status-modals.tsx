"use client";

import { useEffect, type ReactNode } from "react";

function ModalShell({
  open,
  title,
  onClose,
  children,
  busy,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  busy?: boolean;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="app-theme fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/40 p-4 pt-24"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-modal-title"
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="document-modal-title" className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md px-2 py-1 text-sm text-primary hover:bg-primary/10 disabled:opacity-40"
          >
            Close
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmStatusChangeModal({
  open,
  statusLabel,
  count,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  statusLabel: string;
  count: number;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const docs = count === 1 ? "document" : "documents";
  return (
    <ModalShell open={open} title="Change status" onClose={onClose} busy={busy}>
      <p className="text-sm text-foreground">
        Change status to <span className="font-semibold text-primary">&quot;{statusLabel}&quot;</span>
        {count > 1 ? ` for ${count} ${docs}` : ""}?
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onClose}
          className="rounded-md border border-primary/30 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-40"
        >
          No
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void onConfirm()}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-40"
        >
          {busy ? "Updating…" : "Yes"}
        </button>
      </div>
    </ModalShell>
  );
}
