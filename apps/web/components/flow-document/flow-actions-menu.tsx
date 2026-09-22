"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@repo/ui/utils";

export type FlowActionsMenuItem = {
  id: string;
  label: string;
  description?: string;
  onSelect: () => void;
  disabled?: boolean;
};

type Props = {
  items: FlowActionsMenuItem[];
  disabled?: boolean;
  className?: string;
};

export function FlowActionsMenu({ items, disabled = false, className }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3.5 text-sm font-medium text-primary-foreground shadow-sm",
          "hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        Actions
        <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Document actions"
          className="absolute right-0 z-50 mt-1.5 w-72 overflow-hidden rounded-lg border border-border bg-surface py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              className="block w-full px-3.5 py-2.5 text-left hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => {
                if (item.disabled) {
                  return;
                }
                setOpen(false);
                item.onSelect();
              }}
            >
              <span className="block text-sm font-medium text-foreground">{item.label}</span>
              {item.description ? (
                <span className="mt-0.5 block text-xs leading-snug text-muted">{item.description}</span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M7 10l5 5 5-5H7z" />
    </svg>
  );
}
