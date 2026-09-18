/**
 * Flow TipTap table nodes with Google Docs–style cell/table attributes.
 */
import { Table } from "@tiptap/extension-table";
import { TableCell } from "@tiptap/extension-table-cell";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableRow } from "@tiptap/extension-table-row";
import type { JSONContent } from "@tiptap/core";

export type FlowCellVerticalAlign = "top" | "middle" | "bottom";
export type FlowTableAlign = "left" | "center" | "right";

export type FlowTableOptionsState = {
  columnWidthInches: number | null;
  minRowHeightInches: number | null;
  cellPaddingInches: number;
  verticalAlign: FlowCellVerticalAlign;
  borderColor: string;
  borderWidthPt: number;
  backgroundColor: string;
  tableAlign: FlowTableAlign;
};

export const DEFAULT_FLOW_TABLE_OPTIONS: FlowTableOptionsState = {
  columnWidthInches: null,
  minRowHeightInches: null,
  cellPaddingInches: 0.05,
  verticalAlign: "top",
  borderColor: "#000000",
  borderWidthPt: 0,
  backgroundColor: "transparent",
  tableAlign: "left",
};

function styleFromAttrs(attrs: Record<string, unknown>): string {
  const parts: string[] = [];
  const bg = typeof attrs.backgroundColor === "string" ? attrs.backgroundColor : "";
  if (bg && bg !== "transparent") {
    parts.push(`background-color: ${bg}`);
  }
  const borderColor = typeof attrs.borderColor === "string" ? attrs.borderColor : "";
  const borderWidth = typeof attrs.borderWidth === "number" ? attrs.borderWidth : null;
  if (borderColor && borderWidth != null && borderWidth > 0) {
    parts.push(`border: ${borderWidth}pt solid ${borderColor}`);
  } else if (borderWidth === 0) {
    parts.push("border: 0");
  }
  const padding = typeof attrs.paddingInches === "number" ? attrs.paddingInches : null;
  if (padding != null && padding >= 0) {
    parts.push(`padding: ${padding}in`);
  }
  const valign = typeof attrs.verticalAlign === "string" ? attrs.verticalAlign : "";
  if (valign === "top" || valign === "middle" || valign === "bottom") {
    parts.push(`vertical-align: ${valign}`);
  }
  const minHeight = typeof attrs.minHeightInches === "number" ? attrs.minHeightInches : null;
  if (minHeight != null && minHeight > 0) {
    parts.push(`min-height: ${minHeight}in`);
  }
  const width = typeof attrs.widthInches === "number" ? attrs.widthInches : null;
  const widthPercent = typeof attrs.widthPercent === "number" ? attrs.widthPercent : null;
  if (widthPercent != null && widthPercent > 0) {
    parts.push(`width: ${Math.round(widthPercent * 100) / 100}%`);
  } else if (width != null && width > 0) {
    parts.push(`width: ${width}in`);
  } else if (Array.isArray(attrs.colwidth) && Number(attrs.colwidth[0]) > 0) {
    parts.push(`width: ${Math.round(Number(attrs.colwidth[0]))}px`);
  }
  return parts.join("; ");
}

function parseInches(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }
  const match = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*(in|pt|px)?$/i);
  if (!match) {
    return null;
  }
  const n = Number(match[1]);
  const unit = (match[2] ?? "in").toLowerCase();
  if (!Number.isFinite(n)) {
    return null;
  }
  if (unit === "pt") {
    return Math.round((n / 72) * 1000) / 1000;
  }
  if (unit === "px") {
    return Math.round((n / 96) * 1000) / 1000;
  }
  return Math.round(n * 1000) / 1000;
}

function parsePt(raw: string | null | undefined): number | null {
  if (!raw) {
    return null;
  }
  const match = raw.trim().match(/^(-?\d+(?:\.\d+)?)\s*(pt|px|in)?$/i);
  if (!match) {
    return null;
  }
  const n = Number(match[1]);
  const unit = (match[2] ?? "pt").toLowerCase();
  if (!Number.isFinite(n)) {
    return null;
  }
  if (unit === "px") {
    return Math.round(n * (72 / 96) * 100) / 100;
  }
  if (unit === "in") {
    return Math.round(n * 72 * 100) / 100;
  }
  return Math.round(n * 100) / 100;
}

function parseBorderWidthPt(styles: Map<string, string>): number {
  const border = (styles.get("border") || "").toLowerCase();
  if (
    border === "0" ||
    border === "none" ||
    border === "0px" ||
    border === "0pt" ||
    styles.get("border-style") === "none" ||
    styles.get("border-width") === "0" ||
    styles.get("border-width") === "0px" ||
    styles.get("border-width") === "0pt"
  ) {
    return 0;
  }

  const sides = [
    styles.get("border-width"),
    styles.get("border-top-width"),
    styles.get("border-right-width"),
    styles.get("border-bottom-width"),
    styles.get("border-left-width"),
  ];
  let max = 0;
  let saw = false;
  for (const side of sides) {
    if (!side) {
      continue;
    }
    saw = true;
    const pt = parsePt(side);
    if (pt != null) {
      max = Math.max(max, pt);
    }
  }
  if (saw) {
    return max;
  }

  // Docs often encodes width inside `border: 1pt solid #000`.
  const fromShorthand = border.match(/(-?\d+(?:\.\d+)?)\s*(pt|px|in)?/);
  if (fromShorthand) {
    return parsePt(fromShorthand[0]) ?? 0;
  }
  return 0;
}

function parseBorderColor(styles: Map<string, string>): string {
  const candidates = [
    styles.get("border-color"),
    styles.get("border-top-color"),
    styles.get("border-right-color"),
    styles.get("border-bottom-color"),
    styles.get("border-left-color"),
  ];
  for (const value of candidates) {
    if (value && value !== "transparent" && value !== "rgba(0, 0, 0, 0)") {
      return value;
    }
  }
  const border = styles.get("border") || "";
  const hex = border.match(/#(?:[0-9a-f]{3}|[0-9a-f]{6})\b/i);
  if (hex) {
    return hex[0];
  }
  return "";
}

function parseWidthToColwidthPx(styles: Map<string, string>): number[] | null {
  const width = styles.get("width");
  if (!width) {
    return null;
  }
  const pxMatch = width.trim().match(/^(-?\d+(?:\.\d+)?)\s*px$/i);
  if (pxMatch) {
    const n = Math.round(Number(pxMatch[1]));
    return Number.isFinite(n) && n > 0 ? [n] : null;
  }
  const inches = parseInches(width);
  if (inches != null && inches > 0) {
    return [Math.round(inches * 96)];
  }
  return null;
}

function parseStyleMap(style: string | null): Map<string, string> {
  const map = new Map<string, string>();
  if (!style) {
    return map;
  }
  for (const part of style.split(";")) {
    const colon = part.indexOf(":");
    if (colon < 0) {
      continue;
    }
    map.set(part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim());
  }
  return map;
}

const cellAttrs = {
  colspan: { default: 1 },
  rowspan: { default: 1 },
  colwidth: {
    default: null as number[] | null,
    parseHTML: (element: HTMLElement) => {
      const colwidth = element.getAttribute("colwidth");
      const value = colwidth ? colwidth.split(",").map((w) => parseInt(w, 10)) : null;
      if (value?.every((n) => Number.isFinite(n))) {
        return value;
      }
      return parseWidthToColwidthPx(parseStyleMap(element.getAttribute("style")));
    },
  },
  backgroundColor: {
    default: "transparent",
    parseHTML: (element: HTMLElement) => {
      const styles = parseStyleMap(element.getAttribute("style"));
      return styles.get("background-color") || element.getAttribute("bgcolor") || "transparent";
    },
  },
  borderColor: {
    default: "",
    parseHTML: (element: HTMLElement) => {
      return parseBorderColor(parseStyleMap(element.getAttribute("style")));
    },
  },
  borderWidth: {
    default: 0,
    parseHTML: (element: HTMLElement) => {
      return parseBorderWidthPt(parseStyleMap(element.getAttribute("style")));
    },
  },
  paddingInches: {
    default: 0.05,
    parseHTML: (element: HTMLElement) => {
      const styles = parseStyleMap(element.getAttribute("style"));
      return (
        parseInches(styles.get("padding") || styles.get("padding-top") || styles.get("padding-left")) ?? 0.05
      );
    },
  },
  verticalAlign: {
    default: "top" as FlowCellVerticalAlign,
    parseHTML: (element: HTMLElement) => {
      const styles = parseStyleMap(element.getAttribute("style"));
      const v = (styles.get("vertical-align") || element.getAttribute("valign") || "top").toLowerCase();
      if (v === "middle" || v === "center") {
        return "middle";
      }
      if (v === "bottom") {
        return "bottom";
      }
      return "top";
    },
  },
  minHeightInches: {
    default: null as number | null,
    parseHTML: (element: HTMLElement) => {
      const styles = parseStyleMap(element.getAttribute("style"));
      return parseInches(styles.get("min-height"));
    },
  },
  widthInches: {
    default: null as number | null,
    parseHTML: (element: HTMLElement) => {
      const styles = parseStyleMap(element.getAttribute("style"));
      const width = styles.get("width");
      if (width?.trim().endsWith("%")) {
        return null;
      }
      return parseInches(width);
    },
  },
  widthPercent: {
    default: null as number | null,
    parseHTML: (element: HTMLElement) => {
      const styles = parseStyleMap(element.getAttribute("style"));
      const width = styles.get("width")?.trim();
      if (!width?.endsWith("%")) {
        return null;
      }
      const n = Number(width.slice(0, -1));
      return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
    },
  },
};

function renderCellHTML(
  tag: "td" | "th",
  HTMLAttributes: Record<string, unknown>,
): [string, Record<string, unknown>, 0] {
  const attrs = { ...HTMLAttributes };
  const style = styleFromAttrs(attrs);
  const out: Record<string, unknown> = {
    colspan: attrs.colspan,
    rowspan: attrs.rowspan,
  };
  if (Array.isArray(attrs.colwidth) && attrs.colwidth.length) {
    out.colwidth = (attrs.colwidth as number[]).join(",");
  }
  if (style) {
    out.style = style;
  }
  return [tag, out, 0];
}

export const FlowTableCell = TableCell.extend({
  addAttributes() {
    return cellAttrs;
  },
  renderHTML({ HTMLAttributes }) {
    return renderCellHTML("td", HTMLAttributes);
  },
});

export const FlowTableHeader = TableHeader.extend({
  addAttributes() {
    return cellAttrs;
  },
  renderHTML({ HTMLAttributes }) {
    return renderCellHTML("th", HTMLAttributes);
  },
});

export const FlowTableRow = TableRow;

export const FlowTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      tableAlign: {
        default: "left" as FlowTableAlign,
        parseHTML: (element: HTMLElement) => {
          const align = (element.getAttribute("data-table-align") || element.style.marginLeft || "").toLowerCase();
          if (align === "center" || element.style.marginLeft === "auto") {
            return "center";
          }
          if (align === "right") {
            return "right";
          }
          return "left";
        },
        renderHTML: (attributes) => {
          const align = attributes.tableAlign as FlowTableAlign;
          const style =
            align === "center"
              ? "margin-left: auto; margin-right: auto;"
              : align === "right"
                ? "margin-left: auto; margin-right: 0;"
                : "";
          return {
            "data-table-align": align,
            ...(style ? { style } : {}),
          };
        },
      },
    };
  },
}).configure({
  resizable: true,
  lastColumnResizable: true,
  HTMLAttributes: {
    class: "flow-table",
  },
});

export function isTableNode(node: JSONContent | null | undefined): boolean {
  return node?.type === "table";
}
