"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

function useDismissable(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) close();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);
  return ref;
}

function Popover({
  trigger,
  label,
  children,
  widthClass = "w-60",
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  label: string;
  children: ReactNode;
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useDismissable(open, () => setOpen(false));
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open ? (
        <div
          role="dialog"
          aria-label={label}
          className={`absolute right-0 z-40 mt-1 ${widthClass} border border-border bg-surface py-2 text-sm shadow-lg`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export type FilterOption = { value: string; label: string };
export type FilterGroup = {
  id: string;
  label: string;
  hint?: string;
  options: FilterOption[];
  selected: string[];
};

export function FilterMenu({
  groups,
  activeCount,
  onToggle,
  onReset,
}: {
  groups: FilterGroup[];
  activeCount: number;
  onToggle: (groupId: string, value: string) => void;
  onReset: () => void;
}) {
  return (
    <Popover
      label="Filter contacts"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          aria-expanded={open}
          onClick={toggle}
          className="rounded-none border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
        >
          Filter{activeCount ? ` (${activeCount})` : ""} ▾
        </button>
      )}
    >
      {groups.map((group, index) => (
        <fieldset key={group.id} className={index > 0 ? "mt-2 border-t border-border pt-2" : ""}>
          <legend className="px-3 text-xs font-semibold uppercase tracking-wide text-muted">
            {group.label}
          </legend>
          {group.hint ? <p className="px-3 text-xs text-muted">{group.hint}</p> : null}
          {group.options.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-center gap-2 px-3 py-1 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={group.selected.includes(option.value)}
                onChange={() => onToggle(group.id, option.value)}
              />
              <span className="text-foreground">{option.label}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <div className="mt-2 border-t border-border px-3 pt-2">
        <button type="button" onClick={onReset} className="text-xs text-primary hover:underline">
          Reset to default
        </button>
      </div>
    </Popover>
  );
}

export type ColumnOption = { key: string; label: string; locked?: boolean };

export function ColumnsMenu({
  columns,
  hidden,
  onToggle,
  onShowAll,
}: {
  columns: ColumnOption[];
  hidden: Set<string>;
  onToggle: (key: string) => void;
  onShowAll: () => void;
}) {
  return (
    <Popover
      label="Show or hide columns"
      widthClass="w-52"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          aria-label="Show or hide columns"
          title="Show or hide columns"
          aria-expanded={open}
          onClick={toggle}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-none border border-border bg-surface text-foreground hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      )}
    >
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">Columns</p>
      {columns.map((column) => (
        <label
          key={column.key}
          className={`flex items-center gap-2 px-3 py-1 ${column.locked ? "opacity-50" : "cursor-pointer hover:bg-slate-50"}`}
        >
          <input
            type="checkbox"
            disabled={column.locked}
            checked={!hidden.has(column.key)}
            onChange={() => onToggle(column.key)}
          />
          <span className="text-foreground">{column.label}</span>
        </label>
      ))}
      <div className="mt-2 border-t border-border px-3 pt-2">
        <button type="button" onClick={onShowAll} className="text-xs text-primary hover:underline">
          Show all columns
        </button>
      </div>
    </Popover>
  );
}
