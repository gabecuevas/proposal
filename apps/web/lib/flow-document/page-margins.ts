/**
 * Flow page margins — Google Docs Letter defaults (1" all sides) + clamp/snap helpers.
 */
import type { EditorDoc, JSONValue } from "@/lib/editor/types";

export const FLOW_PAGE_MARGINS_ATTR = "flow_page_margins";

/** CSS px per inch (PaginationPlus / screen). */
export const FLOW_DPI = 96;

/** Google Docs default Letter margins. */
export const DEFAULT_FLOW_PAGE_MARGINS = {
  topInches: 1,
  rightInches: 1,
  bottomInches: 1,
  leftInches: 1,
} as const;

export type FlowPageMargins = {
  topInches: number;
  rightInches: number;
  bottomInches: number;
  leftInches: number;
};

export type FlowMarginEdge = "top" | "right" | "bottom" | "left";

/** Minimum content width/height Google Docs keeps when dragging margins. */
const MIN_CONTENT_INCHES = 0.5;

/** Drag snap — Docs allows fine adjustment; 1/8" matches common ruler notches. */
export const FLOW_MARGIN_SNAP_INCHES = 0.125;

export function inchesToPx(inches: number, dpi = FLOW_DPI): number {
  return Math.round(inches * dpi);
}

export function pxToInches(px: number, dpi = FLOW_DPI): number {
  return Math.round((px / dpi) * 1000) / 1000;
}

function asInches(value: unknown, fallback: number): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return Math.round(n * 1000) / 1000;
}

export function parseFlowPageMargins(raw: unknown): FlowPageMargins {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_FLOW_PAGE_MARGINS };
  }
  const obj = raw as Record<string, unknown>;
  return {
    topInches: asInches(obj.topInches, DEFAULT_FLOW_PAGE_MARGINS.topInches),
    rightInches: asInches(obj.rightInches, DEFAULT_FLOW_PAGE_MARGINS.rightInches),
    bottomInches: asInches(obj.bottomInches, DEFAULT_FLOW_PAGE_MARGINS.bottomInches),
    leftInches: asInches(obj.leftInches, DEFAULT_FLOW_PAGE_MARGINS.leftInches),
  };
}

export function flowPageMarginsFromDoc(doc: EditorDoc | null | undefined): FlowPageMargins {
  return parseFlowPageMargins(doc?.attrs?.[FLOW_PAGE_MARGINS_ATTR]);
}

export function withFlowPageMargins(doc: EditorDoc, margins: FlowPageMargins): EditorDoc {
  const next = structuredClone(doc);
  next.attrs = { ...(next.attrs ?? {}) };
  next.attrs[FLOW_PAGE_MARGINS_ATTR] = margins as unknown as JSONValue;
  return next;
}

export function snapMarginInches(inches: number, snap = FLOW_MARGIN_SNAP_INCHES): number {
  if (snap <= 0) {
    return Math.round(inches * 1000) / 1000;
  }
  return Math.round(inches / snap) * snap;
}

/**
 * Clamp a single edge so content area stays ≥ MIN_CONTENT_INCHES (Docs-like).
 */
export function clampFlowPageMargins(
  margins: FlowPageMargins,
  pageWidthInches: number,
  pageHeightInches: number,
): FlowPageMargins {
  const maxLeft = Math.max(0, pageWidthInches - MIN_CONTENT_INCHES - margins.rightInches);
  const maxRight = Math.max(0, pageWidthInches - MIN_CONTENT_INCHES - margins.leftInches);
  const maxTop = Math.max(0, pageHeightInches - MIN_CONTENT_INCHES - margins.bottomInches);
  const maxBottom = Math.max(0, pageHeightInches - MIN_CONTENT_INCHES - margins.topInches);

  return {
    leftInches: Math.min(Math.max(0, margins.leftInches), maxLeft),
    rightInches: Math.min(Math.max(0, margins.rightInches), maxRight),
    topInches: Math.min(Math.max(0, margins.topInches), maxTop),
    bottomInches: Math.min(Math.max(0, margins.bottomInches), maxBottom),
  };
}

export function setFlowMarginEdge(
  margins: FlowPageMargins,
  edge: FlowMarginEdge,
  inches: number,
  pageWidthInches: number,
  pageHeightInches: number,
): FlowPageMargins {
  const snapped = snapMarginInches(Math.max(0, inches));
  const next = { ...margins, [`${edge}Inches`]: snapped } as FlowPageMargins;
  return clampFlowPageMargins(next, pageWidthInches, pageHeightInches);
}

export function marginsToPaginationPx(margins: FlowPageMargins): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  return {
    top: inchesToPx(margins.topInches),
    right: inchesToPx(margins.rightInches),
    bottom: inchesToPx(margins.bottomInches),
    left: inchesToPx(margins.leftInches),
  };
}

/**
 * Pull @page / body margins from pasted HTML when present (Docs/Word).
 */
export function detectMarginsFromPastedHtml(html: string): Partial<FlowPageMargins> | null {
  if (!html) {
    return null;
  }
  const pageMatch = html.match(/@page[^{]*\{([^}]+)\}/i);
  const body =
    pageMatch?.[1] ??
    html.match(/body\s*\{([^}]*margin[^}]*)\}/i)?.[1] ??
    "";
  if (!body) {
    return null;
  }

  const shorthand = body.match(/margin\s*:\s*([^;]+)/i)?.[1]?.trim();
  if (shorthand) {
    const parts = shorthand.split(/\s+/).map(parseCssLengthToInches).filter((n): n is number => n != null);
    if (parts.length === 1) {
      const v = parts[0]!;
      return { topInches: v, rightInches: v, bottomInches: v, leftInches: v };
    }
    if (parts.length === 2) {
      return { topInches: parts[0], rightInches: parts[1], bottomInches: parts[0], leftInches: parts[1] };
    }
    if (parts.length === 3) {
      return { topInches: parts[0], rightInches: parts[1], bottomInches: parts[2], leftInches: parts[1] };
    }
    if (parts.length >= 4) {
      return { topInches: parts[0], rightInches: parts[1], bottomInches: parts[2], leftInches: parts[3] };
    }
  }

  const top = parseCssLengthToInches(body.match(/margin-top\s*:\s*([^;]+)/i)?.[1]);
  const right = parseCssLengthToInches(body.match(/margin-right\s*:\s*([^;]+)/i)?.[1]);
  const bottom = parseCssLengthToInches(body.match(/margin-bottom\s*:\s*([^;]+)/i)?.[1]);
  const left = parseCssLengthToInches(body.match(/margin-left\s*:\s*([^;]+)/i)?.[1]);
  if (top == null && right == null && bottom == null && left == null) {
    return null;
  }
  return {
    ...(top != null ? { topInches: top } : {}),
    ...(right != null ? { rightInches: right } : {}),
    ...(bottom != null ? { bottomInches: bottom } : {}),
    ...(left != null ? { leftInches: left } : {}),
  };
}

function parseCssLengthToInches(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }
  const match = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*(in|pt|px|cm|mm)?$/i);
  if (!match) {
    return null;
  }
  const n = Number(match[1]);
  const unit = (match[2] ?? "px").toLowerCase();
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  if (unit === "in") {
    return Math.round(n * 1000) / 1000;
  }
  if (unit === "pt") {
    return Math.round((n / 72) * 1000) / 1000;
  }
  if (unit === "cm") {
    return Math.round((n / 2.54) * 1000) / 1000;
  }
  if (unit === "mm") {
    return Math.round((n / 25.4) * 1000) / 1000;
  }
  return Math.round((n / FLOW_DPI) * 1000) / 1000;
}
