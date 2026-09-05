"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type LibraryViewMode = "list" | "preview";

function IconListView({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function IconPreviewEye({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const btnBase =
  "inline-flex h-7 items-center justify-center rounded text-sm font-medium transition-colors disabled:opacity-40";

type Props = {
  viewMode: LibraryViewMode;
  onViewModeChange: (mode: LibraryViewMode) => void;
  showNewFolder?: boolean;
  onNewFolder?: () => void;
  selectionCount?: number;
  selectionMode?: boolean;
  onClearSelection?: () => void;
  onDuplicate?: () => void;
  onMove?: () => void;
  onShare?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  /** Called when Actions opens so the parent can show row checkboxes. */
  onActionsOpen?: () => void;
  menuHint?: string;
  leading?: ReactNode;
};

export function LibraryViewActionsBar({
  viewMode,
  onViewModeChange,
  showNewFolder = false,
  onNewFolder,
  selectionCount = 0,
  selectionMode = false,
  onClearSelection,
  onDuplicate,
  onMove,
  onShare,
  onRename,
  onDelete,
  onActionsOpen,
  menuHint,
  leading,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      // Keep the menu open while picking rows so Actions matches Drive-style select-then-act.
      if (target.closest("[data-library-select]")) {
        return;
      }
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function toggleActions() {
    const next = !open;
    if (next) {
      onActionsOpen?.();
    }
    setOpen(next);
  }

  function runAndClose(fn?: () => void) {
    fn?.();
    setOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
      {leading ? <div className="min-w-0 flex-1">{leading}</div> : <div className="min-w-0 flex-1" />}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {selectionMode && selectionCount > 0 ? (
          <p className="text-xs text-muted">{selectionCount} selected</p>
        ) : null}

        <div
          className="inline-flex h-7 items-center rounded-md border border-border bg-surface p-0.5"
          role="group"
          aria-label="View mode"
        >
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={`${btnBase} w-7 ${
              viewMode === "list"
                ? "bg-primary text-primary-foreground"
                : "text-muted hover:bg-slate-50 hover:text-foreground"
            }`}
            aria-label="List view"
            aria-pressed={viewMode === "list"}
            title="List view"
          >
            <IconListView />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("preview")}
            className={`${btnBase} w-7 ${
              viewMode === "preview"
                ? "bg-primary text-primary-foreground"
                : "text-muted hover:bg-slate-50 hover:text-foreground"
            }`}
            aria-label="Preview view"
            aria-pressed={viewMode === "preview"}
            title="Preview view"
          >
            <IconPreviewEye />
          </button>
        </div>

        {showNewFolder ? (
          <button
            type="button"
            onClick={onNewFolder}
            className={`${btnBase} border border-border px-2.5 text-foreground hover:bg-slate-50`}
          >
            + New Folder
          </button>
        ) : null}

        <div className="relative" ref={rootRef}>
          <button
            type="button"
            onClick={toggleActions}
            className={`${btnBase} gap-1 bg-primary px-2.5 text-primary-foreground hover:opacity-95`}
            aria-expanded={open}
            aria-haspopup="menu"
          >
            Actions
            <IconChevronDown className={open ? "rotate-180" : undefined} />
          </button>
          {open ? (
            <div
              role="menu"
              className="absolute right-0 z-30 mt-1 w-52 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-lg"
            >
              {menuHint ? (
                <p className="border-b border-border px-3 py-2 text-xs text-muted">{menuHint}</p>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                onClick={() => runAndClose(onDuplicate)}
              >
                Duplicate
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                onClick={() => runAndClose(onMove)}
              >
                Move to…
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                onClick={() => runAndClose(onShare)}
              >
                Sharing…
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                onClick={() => runAndClose(onRename)}
              >
                Rename…
              </button>
              <button
                type="button"
                role="menuitem"
                className="block w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-red-50"
                onClick={() => runAndClose(onDelete)}
              >
                Delete…
              </button>
              {selectionMode ? (
                <button
                  type="button"
                  role="menuitem"
                  className="mt-1 block w-full border-t border-border px-3 py-1.5 text-left text-sm text-muted hover:bg-slate-50"
                  onClick={() => {
                    onClearSelection?.();
                    setOpen(false);
                  }}
                >
                  Clear selection
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
