"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  IconDuplicatePage,
  IconEllipsis,
  IconImage,
  IconLibrary,
  IconSliders,
  IconTrash,
} from "./creator-icons";

type Props = {
  page: number;
  pageCount: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onPageProperties: () => void;
  onImportBackground: () => void;
  onDuplicate: () => void;
  onSaveToLibrary: () => Promise<string>;
  onDelete: () => void;
};

export function CreatorPageMenu({
  page,
  pageCount,
  open,
  onToggle,
  onClose,
  onPageProperties,
  onImportBackground,
  onDuplicate,
  onSaveToLibrary,
  onDelete,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const canDelete = pageCount > 1;

  useEffect(() => {
    if (!open) {
      setConfirmDelete(false);
      setStatus("");
      setBusy(false);
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose, open]);

  async function saveToLibrary() {
    setBusy(true);
    setStatus("");
    try {
      const message = await onSaveToLibrary();
      setStatus(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="creator-page-menu" ref={menuRef}>
      <button
        type="button"
        onClick={onToggle}
        className={`inline-flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-white hover:text-slate-700 hover:shadow-sm ${
          open ? "bg-white text-slate-700 shadow-sm" : ""
        }`}
        aria-label={`Page ${page} options`}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <IconEllipsis className="h-3.5 w-3.5" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-7 z-50 w-64 overflow-hidden rounded-lg border border-border bg-surface py-1 text-sm text-foreground shadow-xl"
        >
          {confirmDelete ? (
            <div className="px-2.5 py-2">
              <p className="mb-2 text-sm text-foreground">Delete page {page}?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs text-muted hover:bg-slate-50"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                  onClick={() => {
                    onClose();
                    onDelete();
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <>
              <MenuRow
                Icon={IconSliders}
                label="Page properties"
                onClick={() => {
                  onClose();
                  onPageProperties();
                }}
              />
              <MenuRow
                Icon={IconImage}
                label="Import background image"
                onClick={() => {
                  onClose();
                  onImportBackground();
                }}
              />
              <MenuRow
                Icon={IconDuplicatePage}
                label="Duplicate page"
                onClick={() => {
                  onClose();
                  onDuplicate();
                }}
              />
              <MenuRow
                Icon={IconLibrary}
                label="Save to Content Library"
                disabled={busy}
                onClick={() => void saveToLibrary()}
              />
              <div className="my-1 border-t border-border" />
              <MenuRow
                Icon={IconTrash}
                label="Delete page"
                disabled={!canDelete}
                danger={canDelete}
                onClick={() => {
                  if (!canDelete) {
                    return;
                  }
                  setConfirmDelete(true);
                }}
              />
              {status ? <p className="px-2.5 pb-1.5 pt-0.5 text-xs text-muted">{status}</p> : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function MenuRow({
  Icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  Icon: (props: { className?: string }) => ReactElement;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left ${
        disabled
          ? "cursor-not-allowed text-slate-400"
          : danger
            ? "text-red-600 hover:bg-red-50"
            : "hover:bg-slate-50"
      }`}
    >
      <Icon className={`h-4 w-4 shrink-0 ${disabled ? "text-slate-400" : danger ? "text-red-600" : "text-slate-600"}`} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
