"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

const MIN_COL_WIDTH = 72;
const MAX_COL_WIDTH = 640;

type WidthMap = Record<string, number>;

function storageKeyFor(key: string) {
  return `sheet-col-widths:${key}`;
}

function readWidths(storageKey: string): WidthMap {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(storageKeyFor(storageKey));
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as WidthMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeWidths(storageKey: string, widths: WidthMap) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(storageKeyFor(storageKey), JSON.stringify(widths));
  } catch {
    // ignore quota / private mode
  }
}

export type ResizableColumnDef = {
  id: string;
  defaultWidth: number;
};

export function useResizableColumns(storageKey: string, columns: ResizableColumnDef[]) {
  const defaults = useMemo(() => {
    const map: WidthMap = {};
    for (const column of columns) {
      map[column.id] = column.defaultWidth;
    }
    return map;
  }, [columns]);

  const [widths, setWidths] = useState<WidthMap>(() => ({ ...defaults, ...readWidths(storageKey) }));
  const resizeRef = useRef<{ id: string; startX: number; startWidth: number } | null>(null);

  useEffect(() => {
    setWidths({ ...defaults, ...readWidths(storageKey) });
  }, [defaults, storageKey]);

  const widthFor = useCallback(
    (id: string) => widths[id] ?? defaults[id] ?? 140,
    [defaults, widths],
  );

  const tableMinWidth = useMemo(
    () => columns.reduce((sum, column) => sum + widthFor(column.id), 0),
    [columns, widthFor],
  );

  const beginResize = useCallback(
    (event: ReactPointerEvent, id: string) => {
      event.preventDefault();
      event.stopPropagation();
      resizeRef.current = { id, startX: event.clientX, startWidth: widthFor(id) };
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    [widthFor],
  );

  const onResizeMove = useCallback((event: ReactPointerEvent) => {
    const active = resizeRef.current;
    if (!active) {
      return;
    }
    const nextWidth = Math.min(
      MAX_COL_WIDTH,
      Math.max(MIN_COL_WIDTH, active.startWidth + (event.clientX - active.startX)),
    );
    setWidths((current) => ({ ...current, [active.id]: nextWidth }));
  }, []);

  const endResize = useCallback(
    (event: ReactPointerEvent) => {
      if (!resizeRef.current) {
        return;
      }
      resizeRef.current = null;
      (event.target as HTMLElement).releasePointerCapture(event.pointerId);
      setWidths((current) => {
        writeWidths(storageKey, current);
        return current;
      });
    },
    [storageKey],
  );

  return { widthFor, tableMinWidth, beginResize, onResizeMove, endResize };
}
