"use client";

import { useEffect, useState } from "react";
import { cn } from "@repo/ui/utils";
import {
  DEFAULT_FLOW_TABLE_OPTIONS,
  type FlowCellVerticalAlign,
  type FlowTableAlign,
  type FlowTableOptionsState,
} from "@/lib/flow-document/table-extensions";

type Props = {
  open: boolean;
  initial: FlowTableOptionsState;
  onClose: () => void;
  onApply: (next: FlowTableOptionsState) => void;
};

/**
 * Google Docs–style Table options dialog (Format → Table → Table options).
 */
export function TableOptionsModal({ open, initial, onClose, onApply }: Props) {
  const [columnWidth, setColumnWidth] = useState("");
  const [useColumnWidth, setUseColumnWidth] = useState(false);
  const [minRowHeight, setMinRowHeight] = useState("");
  const [useMinRowHeight, setUseMinRowHeight] = useState(false);
  const [cellPadding, setCellPadding] = useState(String(DEFAULT_FLOW_TABLE_OPTIONS.cellPaddingInches));
  const [verticalAlign, setVerticalAlign] = useState<FlowCellVerticalAlign>("top");
  const [borderColor, setBorderColor] = useState(DEFAULT_FLOW_TABLE_OPTIONS.borderColor);
  const [borderWidthPt, setBorderWidthPt] = useState(String(DEFAULT_FLOW_TABLE_OPTIONS.borderWidthPt));
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [transparentBg, setTransparentBg] = useState(true);
  const [tableAlign, setTableAlign] = useState<FlowTableAlign>("left");

  useEffect(() => {
    if (!open) {
      return;
    }
    setUseColumnWidth(initial.columnWidthInches != null);
    setColumnWidth(initial.columnWidthInches != null ? String(initial.columnWidthInches) : "1.5");
    setUseMinRowHeight(initial.minRowHeightInches != null);
    setMinRowHeight(initial.minRowHeightInches != null ? String(initial.minRowHeightInches) : "0.2");
    setCellPadding(String(initial.cellPaddingInches));
    setVerticalAlign(initial.verticalAlign);
    setBorderColor(initial.borderColor || "#000000");
    setBorderWidthPt(String(initial.borderWidthPt));
    const bg = initial.backgroundColor;
    const isTransparent = !bg || bg === "transparent";
    setTransparentBg(isTransparent);
    setBackgroundColor(isTransparent ? "#ffffff" : bg);
    setTableAlign(initial.tableAlign);
  }, [open, initial]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  function apply() {
    onApply({
      columnWidthInches: useColumnWidth ? clampInches(columnWidth, 1.5) : null,
      minRowHeightInches: useMinRowHeight ? clampInches(minRowHeight, 0.2) : null,
      cellPaddingInches: clampInches(cellPadding, DEFAULT_FLOW_TABLE_OPTIONS.cellPaddingInches),
      verticalAlign,
      borderColor,
      borderWidthPt: clampPt(borderWidthPt, DEFAULT_FLOW_TABLE_OPTIONS.borderWidthPt),
      backgroundColor: transparentBg ? "transparent" : backgroundColor,
      tableAlign,
    });
    onClose();
  }

  return (
    <div className="flow-hf-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="flow-table-options-title"
        className="flow-hf-modal flow-table-options-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="flow-table-options-title" className="flow-hf-modal-title">
          Table options
        </h2>

        <section className="flow-hf-modal-section">
          <h3 className="flow-hf-modal-section-title">Column</h3>
          <label className="flow-hf-modal-check">
            <input
              type="checkbox"
              checked={useColumnWidth}
              onChange={(event) => setUseColumnWidth(event.target.checked)}
            />
            Column width
          </label>
          <label className="flow-hf-modal-field">
            <span>Width (inches)</span>
            <input
              type="text"
              inputMode="decimal"
              disabled={!useColumnWidth}
              value={columnWidth}
              onChange={(event) => setColumnWidth(event.target.value)}
              className="flow-hf-modal-input"
            />
          </label>
        </section>

        <section className="flow-hf-modal-section">
          <h3 className="flow-hf-modal-section-title">Row</h3>
          <label className="flow-hf-modal-check">
            <input
              type="checkbox"
              checked={useMinRowHeight}
              onChange={(event) => setUseMinRowHeight(event.target.checked)}
            />
            Minimum row height
          </label>
          <label className="flow-hf-modal-field">
            <span>Height (inches)</span>
            <input
              type="text"
              inputMode="decimal"
              disabled={!useMinRowHeight}
              value={minRowHeight}
              onChange={(event) => setMinRowHeight(event.target.value)}
              className="flow-hf-modal-input"
            />
          </label>
        </section>

        <section className="flow-hf-modal-section">
          <h3 className="flow-hf-modal-section-title">Cell</h3>
          <label className="flow-hf-modal-field">
            <span>Cell padding (inches)</span>
            <input
              type="text"
              inputMode="decimal"
              value={cellPadding}
              onChange={(event) => setCellPadding(event.target.value)}
              className="flow-hf-modal-input"
            />
          </label>
          <fieldset className="flow-table-align-fieldset">
            <legend>Vertical alignment</legend>
            {(
              [
                ["top", "Top"],
                ["middle", "Middle"],
                ["bottom", "Bottom"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flow-hf-modal-check">
                <input
                  type="radio"
                  name="flow-cell-valign"
                  checked={verticalAlign === value}
                  onChange={() => setVerticalAlign(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        </section>

        <section className="flow-hf-modal-section">
          <h3 className="flow-hf-modal-section-title">Border &amp; background</h3>
          <div className="flow-table-options-row">
            <label className="flow-hf-modal-field">
              <span>Border color</span>
              <input
                type="color"
                value={normalizeHex(borderColor)}
                onChange={(event) => setBorderColor(event.target.value)}
                className="flow-table-color-input"
              />
            </label>
            <label className="flow-hf-modal-field">
              <span>Border width (pt)</span>
              <input
                type="text"
                inputMode="decimal"
                value={borderWidthPt}
                onChange={(event) => setBorderWidthPt(event.target.value)}
                className="flow-hf-modal-input"
              />
            </label>
          </div>
          <label className="flow-hf-modal-check">
            <input
              type="checkbox"
              checked={transparentBg}
              onChange={(event) => setTransparentBg(event.target.checked)}
            />
            Transparent background
          </label>
          <label className="flow-hf-modal-field">
            <span>Background color</span>
            <input
              type="color"
              disabled={transparentBg}
              value={normalizeHex(backgroundColor)}
              onChange={(event) => setBackgroundColor(event.target.value)}
              className="flow-table-color-input"
            />
          </label>
        </section>

        <section className="flow-hf-modal-section">
          <h3 className="flow-hf-modal-section-title">Table</h3>
          <fieldset className="flow-table-align-fieldset">
            <legend>Alignment</legend>
            {(
              [
                ["left", "Left"],
                ["center", "Center"],
                ["right", "Right"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flow-hf-modal-check">
                <input
                  type="radio"
                  name="flow-table-align"
                  checked={tableAlign === value}
                  onChange={() => setTableAlign(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        </section>

        <div className="flow-hf-modal-actions">
          <button type="button" className="flow-hf-modal-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={cn("flow-hf-modal-apply")} onClick={apply}>
            Ok
          </button>
        </div>
      </div>
    </div>
  );
}

function clampInches(raw: string, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return Math.min(8, Math.round(n * 1000) / 1000);
}

function clampPt(raw: string, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return fallback;
  }
  return Math.min(12, Math.round(n * 100) / 100);
}

function normalizeHex(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#000000";
}
