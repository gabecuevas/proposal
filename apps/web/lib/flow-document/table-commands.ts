import type { Editor } from "@tiptap/core";
import { CellSelection } from "@tiptap/pm/tables";
import {
  DEFAULT_FLOW_TABLE_OPTIONS,
  type FlowCellVerticalAlign,
  type FlowTableAlign,
  type FlowTableOptionsState,
} from "@/lib/flow-document/table-extensions";

function inchesToPx(inches: number): number {
  return Math.round(inches * 96);
}

export function isInFlowTable(editor: Editor | null | undefined): boolean {
  return Boolean(editor?.isActive("table"));
}

export function readFlowTableOptions(editor: Editor): FlowTableOptionsState {
  const cell =
    editor.getAttributes("tableCell")?.backgroundColor != null
      ? editor.getAttributes("tableCell")
      : editor.getAttributes("tableHeader");
  const table = editor.getAttributes("table");

  const borderWidth =
    typeof cell.borderWidth === "number" ? cell.borderWidth : DEFAULT_FLOW_TABLE_OPTIONS.borderWidthPt;
  const padding =
    typeof cell.paddingInches === "number" ? cell.paddingInches : DEFAULT_FLOW_TABLE_OPTIONS.cellPaddingInches;
  const valign = (cell.verticalAlign as FlowCellVerticalAlign) || DEFAULT_FLOW_TABLE_OPTIONS.verticalAlign;
  const widthInches = typeof cell.widthInches === "number" ? cell.widthInches : null;
  const minHeight = typeof cell.minHeightInches === "number" ? cell.minHeightInches : null;
  const colwidth = Array.isArray(cell.colwidth) ? (cell.colwidth as number[])[0] : null;
  const columnWidthInches =
    widthInches ?? (typeof colwidth === "number" && colwidth > 0 ? Math.round((colwidth / 96) * 100) / 100 : null);

  return {
    columnWidthInches,
    minRowHeightInches: minHeight,
    cellPaddingInches: padding,
    verticalAlign: valign === "middle" || valign === "bottom" ? valign : "top",
    borderColor: typeof cell.borderColor === "string" ? cell.borderColor : DEFAULT_FLOW_TABLE_OPTIONS.borderColor,
    borderWidthPt: borderWidth,
    backgroundColor:
      typeof cell.backgroundColor === "string" ? cell.backgroundColor : DEFAULT_FLOW_TABLE_OPTIONS.backgroundColor,
    tableAlign: (table.tableAlign as FlowTableAlign) || DEFAULT_FLOW_TABLE_OPTIONS.tableAlign,
  };
}

function forEachSelectedCell(editor: Editor, update: (attrs: Record<string, unknown>) => Record<string, unknown>): void {
  const { state, view } = editor;
  const { selection, tr, schema } = state;
  const cellType = schema.nodes.tableCell;
  const headerType = schema.nodes.tableHeader;
  if (!cellType || !headerType) {
    return;
  }

  if (selection instanceof CellSelection) {
    selection.forEachCell((node, pos) => {
      if (node.type !== cellType && node.type !== headerType) {
        return;
      }
      tr.setNodeMarkup(pos, undefined, update({ ...node.attrs }));
    });
    if (tr.docChanged) {
      view.dispatch(tr);
    }
    return;
  }

  // Single caret inside a cell — update that cell (and optionally header).
  const $from = selection.$from;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type === cellType || node.type === headerType) {
      const pos = $from.before(depth);
      tr.setNodeMarkup(pos, undefined, update({ ...node.attrs }));
      if (tr.docChanged) {
        view.dispatch(tr);
      }
      return;
    }
  }
}

export function applyFlowTableOptions(editor: Editor, next: FlowTableOptionsState): void {
  if (!editor.isActive("table")) {
    return;
  }

  forEachSelectedCell(editor, (attrs) => {
    const updated = { ...attrs };
    updated.paddingInches = next.cellPaddingInches;
    updated.verticalAlign = next.verticalAlign;
    updated.borderColor = next.borderColor;
    updated.borderWidth = next.borderWidthPt;
    updated.backgroundColor = next.backgroundColor;
    updated.minHeightInches = next.minRowHeightInches;
    if (next.columnWidthInches != null && next.columnWidthInches > 0) {
      updated.widthInches = next.columnWidthInches;
      updated.colwidth = [inchesToPx(next.columnWidthInches)];
    }
    return updated;
  });

  editor.chain().focus().updateAttributes("table", { tableAlign: next.tableAlign }).run();
}

export function setSelectedCellsAttr(
  editor: Editor,
  key: string,
  value: string | number | null,
): void {
  forEachSelectedCell(editor, (attrs) => ({ ...attrs, [key]: value }));
}

export function distributeFlowTableColumns(editor: Editor): boolean {
  if (!editor.isActive("table")) {
    return false;
  }
  const { state, view } = editor;
  const { selection, schema } = state;
  const $from = selection.$from;
  let tablePos = -1;
  let tableNode = null as ReturnType<typeof $from.node> | null;
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth);
    if (node.type === schema.nodes.table) {
      tablePos = $from.before(depth);
      tableNode = node;
      break;
    }
  }
  if (!tableNode || tablePos < 0) {
    return false;
  }

  const firstRow = tableNode.firstChild;
  if (!firstRow) {
    return false;
  }
  const colCount = firstRow.childCount;
  if (colCount < 1) {
    return false;
  }
  // Letter content width ≈ 6.5in with 1" margins; keep a Docs-like usable width.
  const totalPx = 624;
  const each = Math.floor(totalPx / colCount);
  const tr = state.tr;
  tableNode.descendants((node, pos) => {
    if (node.type !== schema.nodes.tableCell && node.type !== schema.nodes.tableHeader) {
      return;
    }
    const absolutePos = tablePos + 1 + pos;
    tr.setNodeMarkup(absolutePos, undefined, {
      ...node.attrs,
      colwidth: [each],
      widthInches: Math.round((each / 96) * 100) / 100,
    });
  });
  if (tr.docChanged) {
    view.dispatch(tr);
  }
  return true;
}

/** Ensure every table cell has widthPercent from colwidth / widthInches ratios. */
export function ensureFlowTableWidthPercents(editor: Editor): boolean {
  const { state, view } = editor;
  const { schema } = state;
  const tableType = schema.nodes.table;
  const rowType = schema.nodes.tableRow;
  const cellType = schema.nodes.tableCell;
  const headerType = schema.nodes.tableHeader;
  if (!tableType || !rowType || !cellType || !headerType) {
    return false;
  }

  const tr = state.tr;
  state.doc.descendants((node, pos) => {
    if (node.type !== tableType) {
      return;
    }
    const firstRow = node.firstChild;
    if (!firstRow || firstRow.type !== rowType || firstRow.childCount === 0) {
      return;
    }
    const widths: number[] = [];
    firstRow.forEach((cell) => {
      const colwidth = Array.isArray(cell.attrs.colwidth) ? Number(cell.attrs.colwidth[0]) : 0;
      const inches = typeof cell.attrs.widthInches === "number" ? cell.attrs.widthInches : 0;
      const existing = typeof cell.attrs.widthPercent === "number" ? cell.attrs.widthPercent : 0;
      if (colwidth > 0) {
        widths.push(colwidth);
      } else if (inches > 0) {
        widths.push(Math.round(inches * 96));
      } else if (existing > 0) {
        widths.push(existing);
      } else {
        widths.push(0);
      }
    });
    const known = widths.filter((w) => w > 0);
    if (known.length === 0) {
      return;
    }
    const fallback = Math.round(known.reduce((a, b) => a + b, 0) / known.length);
    const resolved = widths.map((w) => (w > 0 ? w : fallback));
    const total = resolved.reduce((a, b) => a + b, 0) || 1;
    const percents = resolved.map((w) => Math.max(8, Math.round((w / total) * 10000) / 100));

    node.forEach((rowNode, rowOffsetInTable) => {
      if (rowNode.type !== rowType) {
        return;
      }
      let col = 0;
      rowNode.forEach((cell, cellOffset) => {
        if (cell.type !== cellType && cell.type !== headerType) {
          return;
        }
        const pct = percents[Math.min(col, percents.length - 1)] ?? 50;
        col += 1;
        if (cell.attrs.widthPercent === pct) {
          return;
        }
        const absolutePos = pos + 1 + rowOffsetInTable + 1 + cellOffset;
        tr.setNodeMarkup(absolutePos, undefined, {
          ...cell.attrs,
          widthPercent: pct,
        });
      });
    });
  });

  if (tr.docChanged) {
    view.dispatch(tr);
    return true;
  }
  return false;
}

/** Remove cell borders on every table in the doc (Docs borderless paste heal). */
export function clearAllFlowTableBorders(editor: Editor): boolean {
  const { state, view } = editor;
  const { schema } = state;
  const cellType = schema.nodes.tableCell;
  const headerType = schema.nodes.tableHeader;
  if (!cellType || !headerType) {
    return false;
  }
  const tr = state.tr;
  state.doc.descendants((node, pos) => {
    if (node.type !== cellType && node.type !== headerType) {
      return;
    }
    if (node.attrs.borderWidth === 0 && !node.attrs.borderColor) {
      return;
    }
    tr.setNodeMarkup(pos, undefined, {
      ...node.attrs,
      borderWidth: 0,
      borderColor: "",
    });
  });
  if (tr.docChanged) {
    view.dispatch(tr);
    return true;
  }
  return false;
}

export function openFlowTableOptionsEvent(): void {
  window.dispatchEvent(new Event("flow-open-table-options-modal"));
}
