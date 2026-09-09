"use client";

import { useEffect, useRef, useState } from "react";

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const btnBase =
  "inline-flex h-7 items-center justify-center rounded text-sm font-medium transition-colors disabled:opacity-40";

export type DocumentStatusChangeTarget = {
  status: "SIGNED" | "VOID" | "EXPIRED" | "TRASHED";
  label: string;
};

export const DOCUMENT_STATUS_CHANGE_OPTIONS: DocumentStatusChangeTarget[] = [
  { status: "SIGNED", label: "Completed" },
  { status: "VOID", label: "Declined" },
  { status: "EXPIRED", label: "Archive/Expired" },
  { status: "TRASHED", label: "Trash" },
];

type Props = {
  selectionCount?: number;
  selectionMode?: boolean;
  onClearSelection?: () => void;
  onChangeStatus?: (target: DocumentStatusChangeTarget) => void;
  onRename?: () => void;
  onDelete?: () => void;
  onActionsOpen?: () => void;
  menuHint?: string;
};

export function DocumentsViewActionsBar({
  selectionCount = 0,
  selectionMode = false,
  onClearSelection,
  onChangeStatus,
  onRename,
  onDelete,
  onActionsOpen,
  menuHint,
}: Props) {
  const [open, setOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as HTMLElement | null;
      if (!target) {
        return;
      }
      if (target.closest("[data-library-select]")) {
        return;
      }
      if (!rootRef.current?.contains(target)) {
        setOpen(false);
        setStatusOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function toggleActions() {
    const next = !open;
    if (next) {
      onActionsOpen?.();
    } else {
      setStatusOpen(false);
    }
    setOpen(next);
  }

  function runAndClose(fn?: () => void) {
    fn?.();
    setOpen(false);
    setStatusOpen(false);
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-b border-border px-4 py-2">
      {selectionMode && selectionCount > 0 ? (
        <p className="mr-auto text-xs text-muted">{selectionCount} selected</p>
      ) : (
        <div className="mr-auto" />
      )}

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
            className="absolute right-0 z-30 mt-1 w-56 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-lg"
          >
            {menuHint ? (
              <p className="border-b border-border px-3 py-2 text-xs text-muted">{menuHint}</p>
            ) : null}
            <div className="relative">
              <button
                type="button"
                role="menuitem"
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                onClick={() => setStatusOpen((value) => !value)}
              >
                Change Status
                <IconChevronDown className={statusOpen ? "rotate-180" : "-rotate-90"} />
              </button>
              {statusOpen ? (
                <div className="border-t border-border bg-slate-50/80 py-1">
                  {DOCUMENT_STATUS_CHANGE_OPTIONS.map((option) => (
                    <button
                      key={option.status}
                      type="button"
                      role="menuitem"
                      className="block w-full px-5 py-1.5 text-left text-sm text-foreground hover:bg-primary/10 hover:text-primary"
                      onClick={() => runAndClose(() => onChangeStatus?.(option))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
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
                  setStatusOpen(false);
                }}
              >
                Clear selection
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
