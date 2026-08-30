export type GridSortDir = "asc" | "desc";

export type GridPrefs = {
  visible: string[];
  widths: Record<string, number>;
  sort: { id: string; dir: GridSortDir } | null;
};

export type GridColumnMeta = {
  id: string;
  defaultVisible?: boolean;
  required?: boolean;
};

export function defaultVisibleIds(columns: GridColumnMeta[]): string[] {
  return columns.filter((column) => column.defaultVisible !== false).map((column) => column.id);
}

export function mergeGridPrefs(stored: Partial<GridPrefs> | null, columns: GridColumnMeta[]): GridPrefs {
  const defaults = defaultVisibleIds(columns);
  const known = new Set(columns.map((column) => column.id));
  const required = new Set(columns.filter((column) => column.required).map((column) => column.id));
  const storedVisible = (stored?.visible ?? []).filter((id) => known.has(id));
  const visible = storedVisible.length > 0 ? [...storedVisible] : [...defaults];
  for (const id of required) {
    if (!visible.includes(id)) {
      visible.unshift(id);
    }
  }
  const widths: Record<string, number> = {};
  for (const [id, width] of Object.entries(stored?.widths ?? {})) {
    if (known.has(id) && Number.isFinite(width) && width >= 72) {
      widths[id] = Math.round(width);
    }
  }
  const sort =
    stored?.sort && known.has(stored.sort.id) && (stored.sort.dir === "asc" || stored.sort.dir === "desc")
      ? stored.sort
      : null;
  return { visible, widths, sort };
}

export function loadGridPrefs(storageKey: string, columns: GridColumnMeta[]): GridPrefs {
  if (typeof window === "undefined") {
    return mergeGridPrefs(null, columns);
  }
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed = raw ? (JSON.parse(raw) as Partial<GridPrefs>) : null;
    return mergeGridPrefs(parsed, columns);
  } catch {
    return mergeGridPrefs(null, columns);
  }
}

export function saveGridPrefs(storageKey: string, prefs: GridPrefs): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(prefs));
}

export function compareGridValues(
  left: string | number | null | undefined,
  right: string | number | null | undefined,
  dir: GridSortDir,
): number {
  if (left == null && right == null) {
    return 0;
  }
  if (left == null) {
    return 1;
  }
  if (right == null) {
    return -1;
  }
  if (typeof left === "number" && typeof right === "number") {
    return dir === "asc" ? left - right : right - left;
  }
  const result = String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: "base" });
  return dir === "asc" ? result : -result;
}
