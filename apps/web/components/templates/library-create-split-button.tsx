"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@repo/ui/utils";
import { IconChevronDown } from "@/components/app-shell/shell-icons";
import {
  DOCUMENT_CREATE_KINDS,
  documentKindProfile,
  type DocumentCreateKind,
} from "@/lib/editor/document-kind";

type Props = {
  primaryKind?: DocumentCreateKind;
  onSelect: (kind: DocumentCreateKind) => void;
  className?: string;
  /** Compact styling for toolbars vs full-width sidebar CTA. */
  variant?: "sidebar" | "toolbar";
};

export function LibraryCreateSplitButton({
  primaryKind = "document",
  onSelect,
  className,
  variant = "sidebar",
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const primary = documentKindProfile(primaryKind);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const isSidebar = variant === "sidebar";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex overflow-hidden rounded-md bg-primary text-primary-foreground shadow-sm",
          isSidebar ? "w-full" : "inline-flex",
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(primaryKind)}
          className={cn(
            "flex min-w-0 flex-1 items-center justify-center gap-2 font-medium transition-opacity hover:opacity-95",
            isSidebar ? "px-3 py-2.5 text-sm" : "h-8 px-3 text-xs",
          )}
        >
          <span className="text-base leading-none">+</span>
          <span className="truncate">{primary.label}</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "inline-flex items-center justify-center border-l border-primary-foreground/20 transition-opacity hover:opacity-95",
            isSidebar ? "px-2.5" : "h-8 w-8",
            open && "bg-primary-foreground/10",
          )}
          aria-label="More create options"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <IconChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute left-0 z-50 mt-1 min-w-full overflow-hidden rounded-md border border-border bg-white py-1 text-sm text-foreground shadow-lg",
            !isSidebar && "right-0 left-auto min-w-[11rem]",
          )}
        >
          {DOCUMENT_CREATE_KINDS.map((kind) => {
            const profile = documentKindProfile(kind);
            return (
              <button
                key={kind}
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false);
                  onSelect(kind);
                }}
                className="flex w-full items-center px-3 py-2 text-left hover:bg-slate-50"
              >
                {profile.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
