"use client";

import type { ReactNode } from "react";
import {
  DEFAULT_COMMERCIAL_THEME,
  type CommercialLabels,
  type CommercialTheme,
} from "@/lib/commercial/schema";
import { FLOW_GOOGLE_FONTS } from "@/lib/flow-document/google-fonts";

const TITLE_SIZES_PX = [28, 32, 36, 40, 44, 48, 56, 64, 72] as const;

type ColumnHeaderKey = "item" | "quantity" | "rate" | "amount";

type Props = {
  theme: CommercialTheme;
  labels: Pick<CommercialLabels, ColumnHeaderKey>;
  titleLabel: string;
  locked?: boolean;
  onClose: () => void;
  onThemeChange: (theme: CommercialTheme) => void;
  onLabelsChange: (labels: Pick<CommercialLabels, ColumnHeaderKey>) => void;
};

/**
 * Right shelf — Page properties for Quote/Invoice theme
 * (line-item header color/labels + document title font/color/size).
 */
export function CommercialPagePropertiesPanel({
  theme,
  labels,
  titleLabel,
  locked = false,
  onClose,
  onThemeChange,
  onLabelsChange,
}: Props) {
  function patchTheme(partial: Partial<CommercialTheme>) {
    if (locked) {
      return;
    }
    onThemeChange({ ...theme, ...partial });
  }

  function patchLabel(key: ColumnHeaderKey, value: string) {
    if (locked) {
      return;
    }
    onLabelsChange({ ...labels, [key]: value });
  }

  return (
    <aside className="flow-page-properties" aria-label="Page properties">
      <div className="flow-page-properties-header">
        <h2 className="flow-page-properties-title">Page properties</h2>
        <button
          type="button"
          className="flow-page-properties-close"
          onClick={onClose}
          aria-label="Close page properties"
        >
          ×
        </button>
      </div>

      <Section title="Line item header">
        <Row label="Bar color">
          <label className="flow-page-properties-swatch">
            <span
              className="flow-page-properties-swatch-face"
              style={{ backgroundColor: theme.tableHeaderBg }}
            />
            <input
              type="color"
              value={normalizeHex(theme.tableHeaderBg)}
              disabled={locked}
              aria-label="Line item header bar color"
              onChange={(event) => patchTheme({ tableHeaderBg: event.target.value })}
            />
          </label>
        </Row>
        <Row label="Item">
          <input
            type="text"
            value={labels.item}
            disabled={locked}
            aria-label="Item column header"
            onChange={(event) => patchLabel("item", event.target.value)}
          />
        </Row>
        <Row label="Quantity">
          <input
            type="text"
            value={labels.quantity}
            disabled={locked}
            aria-label="Quantity column header"
            onChange={(event) => patchLabel("quantity", event.target.value)}
          />
        </Row>
        <Row label="Rate">
          <input
            type="text"
            value={labels.rate}
            disabled={locked}
            aria-label="Rate column header"
            onChange={(event) => patchLabel("rate", event.target.value)}
          />
        </Row>
        <Row label="Amount">
          <input
            type="text"
            value={labels.amount}
            disabled={locked}
            aria-label="Amount column header"
            onChange={(event) => patchLabel("amount", event.target.value)}
          />
        </Row>
      </Section>

      <Section title={`${titleLabel || "Document"} title`}>
        <Row label="Font">
          <select
            value={theme.titleFontId}
            disabled={locked}
            aria-label="Title font"
            onChange={(event) => patchTheme({ titleFontId: event.target.value })}
          >
            {FLOW_GOOGLE_FONTS.map((font) => (
              <option key={font.id} value={font.id} style={{ fontFamily: font.family }}>
                {font.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Color">
          <label className="flow-page-properties-swatch">
            <span
              className="flow-page-properties-swatch-face"
              style={{ backgroundColor: theme.titleColor }}
            />
            <input
              type="color"
              value={normalizeHex(theme.titleColor)}
              disabled={locked}
              aria-label="Title color"
              onChange={(event) => patchTheme({ titleColor: event.target.value })}
            />
          </label>
        </Row>
        <Row label="Size">
          <select
            value={String(theme.titleSizePx)}
            disabled={locked}
            aria-label="Title size"
            onChange={(event) => {
              const n = Number(event.target.value);
              if (Number.isFinite(n)) {
                patchTheme({ titleSizePx: n });
              }
            }}
          >
            {TITLE_SIZES_PX.map((size) => (
              <option key={size} value={size}>
                {size}px
              </option>
            ))}
            {!TITLE_SIZES_PX.includes(theme.titleSizePx as (typeof TITLE_SIZES_PX)[number]) ? (
              <option value={theme.titleSizePx}>{theme.titleSizePx}px</option>
            ) : null}
          </select>
        </Row>
        <button
          type="button"
          className="flow-page-properties-action flow-page-properties-action--muted mx-3.5 mb-3"
          disabled={locked}
          onClick={() => onThemeChange({ ...DEFAULT_COMMERCIAL_THEME })}
        >
          Reset to defaults
        </button>
      </Section>
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flow-page-properties-section">
      <h3 className="flow-page-properties-section-title">{title}</h3>
      <div className="flow-page-properties-section-body">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flow-page-properties-row">
      <span className="flow-page-properties-label">{label}</span>
      <div className="flow-page-properties-control">{children}</div>
    </div>
  );
}

function normalizeHex(value: string): string {
  const trimmed = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, a, b, c] = trimmed;
    return `#${a}${a}${b}${b}${c}${c}`.toLowerCase();
  }
  return "#0f2744";
}
