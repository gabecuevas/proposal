"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@repo/ui/utils";
import { IconMore, IconSettings } from "@/components/app-shell/shell-icons";
import {
  compareGridValues,
  defaultVisibleIds,
  loadGridPrefs,
  saveGridPrefs,
  type GridPrefs,
  type GridSortDir,
} from "@/lib/crm/grid-prefs";

export type CrmGridColumn<T> = {
  id: string;
  label: string;
  defaultVisible?: boolean;
  required?: boolean;
  width?: number;
  align?: "left" | "right";
  sortValue?: (row: T) => string | number | null | undefined;
  cell: (row: T) => ReactNode;
};

type CrmDataGridProps<T> = {
  storageKey: string;
  columns: CrmGridColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  emptyLabel: string;
  recordNoun: string;
  recordNounPlural?: string;
  search: {
    value: string;
    placeholder: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
  };
  addLabel: string;
  onAdd: () => void;
  onRowOpen: (row: T) => void;
  error?: string;
};

const MIN_COL_WIDTH = 96;
const MAX_COL_WIDTH = 480;
const CHECK_COL_WIDTH = 42;
const ACTION_COL_WIDTH = 44;

function pluralize(count: number, noun: string, plural?: string): string {
  return `${count} ${count === 1 ? noun : (plural ?? `${noun}s`)}`;
}

function SortMark({ dir }: { dir: GridSortDir | null }) {
  if (!dir) {
    return (
      <span className="text-muted/50" aria-hidden>
        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
          <path d="M6 2.5v7M3.5 7.5L6 10l2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </span>
    );
  }
  return (
    <span className="text-primary" aria-hidden>
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none" className={dir === "asc" ? "rotate-180" : ""}>
        <path d="M6 2.5v7M3.5 7.5L6 10l2.5-2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function CrmDataGrid<T>({
  storageKey,
  columns,
  rows,
  getRowId,
  emptyLabel,
  recordNoun,
  recordNounPlural,
  search,
  addLabel,
  onAdd,
  onRowOpen,
  error,
}: CrmDataGridProps<T>) {
  const columnPickerId = useId();
  const [prefs, setPrefs] = useState<GridPrefs>(() => loadGridPrefs(storageKey, columns));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const pickerRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<{ id: string; startX: number; startWidth: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const xBarRef = useRef<HTMLDivElement>(null);
  const syncingX = useRef(false);
  const [overflowsX, setOverflowsX] = useState(false);
  const [xScrollWidth, setXScrollWidth] = useState(0);

  const columnSignature = columns.map((column) => column.id).join("|");

  useEffect(() => {
    setPrefs(loadGridPrefs(storageKey, columns));
    // Reload when the storage key or column ids change, not on cell renderer identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- columnSignature tracks column ids
  }, [storageKey, columnSignature]);

  const persist = useCallback(
    (next: GridPrefs) => {
      setPrefs(next);
      saveGridPrefs(storageKey, next);
    },
    [storageKey],
  );

  useEffect(() => {
    if (!pickerOpen && !rowMenuId) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        setPickerOpen(false);
      }
      if (!(target instanceof Element) || !target.closest("[data-row-menu]")) {
        setRowMenuId(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPickerOpen(false);
        setRowMenuId(null);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [pickerOpen, rowMenuId]);

  const visibleColumns = useMemo(() => {
    const order = prefs.visible.filter((id) => columns.some((column) => column.id === id));
    return order
      .map((id) => columns.find((column) => column.id === id))
      .filter((column): column is CrmGridColumn<T> => Boolean(column));
  }, [columns, prefs.visible]);

  const sortedRows = useMemo(() => {
    const sort = prefs.sort;
    const column = sort ? columns.find((item) => item.id === sort.id) : undefined;
    if (!sort || !column?.sortValue) {
      return rows;
    }
    return [...rows].sort((left, right) =>
      compareGridValues(column.sortValue?.(left), column.sortValue?.(right), sort.dir),
    );
  }, [columns, prefs.sort, rows]);

  const rowIds = useMemo(() => sortedRows.map(getRowId), [getRowId, sortedRows]);
  const allSelected = rowIds.length > 0 && rowIds.every((id) => selected.has(id));

  function toggleSort(column: CrmGridColumn<T>) {
    if (!column.sortValue) {
      return;
    }
    const current = prefs.sort;
    let next: GridPrefs["sort"] = { id: column.id, dir: "asc" };
    if (current?.id === column.id) {
      next = current.dir === "asc" ? { id: column.id, dir: "desc" } : null;
    }
    persist({ ...prefs, sort: next });
  }

  function toggleColumn(id: string, required?: boolean) {
    if (required) {
      return;
    }
    const visible = prefs.visible.includes(id)
      ? prefs.visible.filter((item) => item !== id)
      : [...prefs.visible, id];
    if (visible.length === 0) {
      return;
    }
    persist({ ...prefs, visible });
  }

  function resetColumns() {
    persist({
      ...prefs,
      visible: defaultVisibleIds(columns),
      widths: {},
      sort: null,
    });
  }

  function widthFor(column: CrmGridColumn<T>): number {
    return prefs.widths[column.id] ?? column.width ?? 160;
  }

  function beginResize(event: React.PointerEvent, column: CrmGridColumn<T>) {
    event.preventDefault();
    event.stopPropagation();
    resizeRef.current = { id: column.id, startX: event.clientX, startWidth: widthFor(column) };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  }

  function onResizeMove(event: React.PointerEvent) {
    const active = resizeRef.current;
    if (!active) {
      return;
    }
    const nextWidth = Math.min(
      MAX_COL_WIDTH,
      Math.max(MIN_COL_WIDTH, active.startWidth + (event.clientX - active.startX)),
    );
    setPrefs((current) => ({ ...current, widths: { ...current.widths, [active.id]: nextWidth } }));
  }

  function endResize(event: React.PointerEvent) {
    if (!resizeRef.current) {
      return;
    }
    resizeRef.current = null;
    (event.target as HTMLElement).releasePointerCapture(event.pointerId);
    setPrefs((current) => {
      saveGridPrefs(storageKey, current);
      return current;
    });
  }

  function toggleRow(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(rowIds));
  }

  const tableMinWidth =
    CHECK_COL_WIDTH + ACTION_COL_WIDTH + visibleColumns.reduce((sum, column) => sum + widthFor(column), 0);

  const measureXOverflow = useCallback(() => {
    const el = bodyRef.current;
    if (!el) {
      return;
    }
    setOverflowsX(el.scrollWidth - el.clientWidth > 1);
    setXScrollWidth(el.scrollWidth);
  }, []);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) {
      return;
    }
    measureXOverflow();
    const observer = new ResizeObserver(measureXOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measureXOverflow, tableMinWidth, visibleColumns.length, sortedRows.length]);

  function syncXFromBody() {
    if (syncingX.current) {
      return;
    }
    const body = bodyRef.current;
    const bar = xBarRef.current;
    if (!body || !bar) {
      return;
    }
    syncingX.current = true;
    bar.scrollLeft = body.scrollLeft;
    syncingX.current = false;
  }

  function syncXFromBar() {
    if (syncingX.current) {
      return;
    }
    const body = bodyRef.current;
    const bar = xBarRef.current;
    if (!body || !bar) {
      return;
    }
    syncingX.current = true;
    body.scrollLeft = bar.scrollLeft;
    syncingX.current = false;
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col bg-surface">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-4 py-3">
        <input
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-surface px-3 text-sm outline-none ring-primary/15 focus:ring-2"
          value={search.value}
          onChange={(event) => search.onChange(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && search.onSubmit()}
          placeholder={search.placeholder}
        />
        <p className="text-sm text-muted">{pluralize(rows.length, recordNoun, recordNounPlural)}</p>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
        >
          {addLabel}
        </button>
      </div>

      {error ? <p className="shrink-0 px-4 py-2 text-sm text-red-600">{error}</p> : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
          <div
            ref={bodyRef}
            className="absolute inset-x-0 top-0 overflow-auto"
            style={{ bottom: overflowsX ? -13 : 0 }}
            onScroll={syncXFromBody}
          >
        <table
          className="w-full table-fixed border-collapse text-left text-[13px]"
          style={{ minWidth: tableMinWidth }}
        >
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-foreground">
                <th
                  className="sticky left-0 z-20 border-b border-r border-border bg-slate-50 px-2"
                  style={{ width: CHECK_COL_WIDTH, minWidth: CHECK_COL_WIDTH }}
                >
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label={`Select all ${recordNounPlural ?? `${recordNoun}s`}`}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                </th>
                {visibleColumns.map((column) => {
                  const dir = prefs.sort?.id === column.id ? prefs.sort.dir : null;
                  const width = widthFor(column);
                  const sortable = Boolean(column.sortValue);
                  return (
                    <th
                      key={column.id}
                      className="relative border-b border-r border-border px-0"
                      style={{ width, minWidth: width, maxWidth: width }}
                      aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(column)}
                          className={cn(
                            "flex h-8 w-full items-center gap-1.5 px-3 text-left hover:bg-slate-100/80",
                            column.align === "right" && "justify-end",
                          )}
                        >
                          <span className="truncate">{column.label}</span>
                          <SortMark dir={dir} />
                        </button>
                      ) : (
                        <span
                          className={cn(
                            "flex h-8 items-center px-3",
                            column.align === "right" && "justify-end",
                          )}
                        >
                          {column.label}
                        </span>
                      )}
                      <span
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Resize ${column.label} column`}
                        onPointerDown={(event) => beginResize(event, column)}
                        onPointerMove={onResizeMove}
                        onPointerUp={endResize}
                        className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize hover:bg-primary/30"
                      />
                    </th>
                  );
                })}
                <th className="min-w-0 border-b border-border bg-slate-50" aria-hidden />
                <th
                  className="sticky right-0 z-20 border-b border-l border-border bg-slate-50 px-1"
                  style={{ width: ACTION_COL_WIDTH, minWidth: ACTION_COL_WIDTH }}
                >
                  <div ref={pickerRef} className="relative flex justify-center">
                    <button
                      type="button"
                      aria-haspopup="menu"
                      aria-expanded={pickerOpen}
                      aria-controls={columnPickerId}
                      aria-label="Choose columns"
                      onClick={() => setPickerOpen((open) => !open)}
                      className="rounded p-1 text-muted hover:bg-slate-100 hover:text-foreground"
                    >
                      <IconSettings className="h-4 w-4" />
                    </button>
                    {pickerOpen ? (
                      <div
                        id={columnPickerId}
                        role="menu"
                        className="absolute right-0 top-full z-40 mt-1 w-56 rounded-md border border-border bg-surface py-2 shadow-lg"
                      >
                        <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
                          Columns
                        </p>
                        <ul className="max-h-72 overflow-y-auto">
                          {columns.map((column) => {
                            const checked = prefs.visible.includes(column.id);
                            return (
                              <li key={column.id}>
                                <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={column.required}
                                    onChange={() => toggleColumn(column.id, column.required)}
                                    className="h-3.5 w-3.5 accent-primary"
                                  />
                                  <span>{column.label}</span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                        <button
                          type="button"
                          onClick={resetColumns}
                          className="mt-1 w-full border-t border-border px-3 pt-2 text-left text-sm text-primary hover:bg-slate-50"
                        >
                          Reset columns
                        </button>
                      </div>
                    ) : null}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => {
                const id = getRowId(row);
                const isSelected = selected.has(id);
                return (
                  <tr
                    key={id}
                    className={cn(
                      "group cursor-pointer border-b border-border hover:bg-slate-50/80",
                      isSelected && "bg-primary/5 hover:bg-primary/10",
                    )}
                    onClick={() => onRowOpen(row)}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-10 border-r border-border bg-surface px-2 group-hover:bg-slate-50/80",
                        isSelected && "bg-primary/5 group-hover:bg-primary/10",
                      )}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(id)}
                        aria-label={`Select ${recordNoun}`}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                    </td>
                    {visibleColumns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          "truncate border-r border-border px-3 py-1.5 text-muted",
                          column.align === "right" && "text-right tabular-nums",
                        )}
                        style={{ width: widthFor(column), minWidth: widthFor(column), maxWidth: widthFor(column) }}
                      >
                        {column.cell(row)}
                      </td>
                    ))}
                    <td className="min-w-0 border-border" aria-hidden />
                    <td
                      className={cn(
                        "sticky right-0 z-10 border-l border-border bg-surface px-1 group-hover:bg-slate-50/80",
                        isSelected && "bg-primary/5 group-hover:bg-primary/10",
                      )}
                      data-row-menu
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="relative flex justify-center">
                        <button
                          type="button"
                          aria-label="Row actions"
                          aria-expanded={rowMenuId === id}
                          onClick={() => setRowMenuId((current) => (current === id ? null : id))}
                          className="rounded p-1 text-muted hover:bg-slate-100 hover:text-foreground"
                        >
                          <IconMore className="h-4 w-4" />
                        </button>
                        {rowMenuId === id ? (
                          <div
                            role="menu"
                            className="absolute right-0 top-full z-30 mt-1 w-32 rounded-md border border-border bg-surface py-1 shadow-lg"
                          >
                            <button
                              type="button"
                              role="menuitem"
                              className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                              onClick={() => {
                                setRowMenuId(null);
                                onRowOpen(row);
                              }}
                            >
                              Edit
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sortedRows.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">{emptyLabel}</p>
          ) : null}
          </div>
        </div>
        {overflowsX ? (
          <div
            ref={xBarRef}
            className="crm-grid-scroll h-3 shrink-0 overflow-x-scroll overflow-y-hidden border-t border-border bg-slate-100"
            role="scrollbar"
            aria-orientation="horizontal"
            aria-label="Scroll columns"
            onScroll={syncXFromBar}
          >
            <div style={{ width: xScrollWidth || tableMinWidth, height: 1 }} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
