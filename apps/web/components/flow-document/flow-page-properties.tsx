"use client";

import type { ReactNode } from "react";
import {
  backgroundForPage,
  formatInches,
  PAGE_BACKGROUND_FITS,
  PAGE_BACKGROUND_POSITIONS,
  type PageBackground,
  type PageBackgroundFit,
  type PageBackgroundPosition,
  type PageBackgrounds,
} from "@/lib/editor/page-backgrounds";
import { FLOW_PAPER_PRESETS, type FlowPaperId } from "@/lib/flow-document/extensions";
import { assetUrl } from "@/lib/storage/asset-url";

type Props = {
  currentPage: number;
  paper: FlowPaperId;
  backgrounds: PageBackgrounds;
  locked?: boolean;
  onClose: () => void;
  onPatch: (pageIndex: number, patch: Partial<PageBackground>) => void;
  onImportBackground: () => void;
  onDuplicate: () => void;
  onClear: (pageIndex: number) => void;
};

/**
 * Right sidebar — Page properties (background color/image, layout, duplicate).
 */
export function FlowPagePropertiesPanel({
  currentPage,
  paper,
  backgrounds,
  locked = false,
  onClose,
  onPatch,
  onImportBackground,
  onDuplicate,
  onClear,
}: Props) {
  const pageIndex = Math.max(0, currentPage - 1);
  const background = backgroundForPage(backgrounds, pageIndex);
  const color = background.color ?? "#ffffff";
  const colorOpacity = background.colorOpacity ?? 100;
  const imageUrl = background.imageKey ? assetUrl(background.imageKey) : null;
  const preset = FLOW_PAPER_PRESETS[paper];
  const widthIn = preset.size.pageWidth / 96;
  const heightIn = preset.size.pageHeight / 96;

  function patch(next: Partial<PageBackground>) {
    if (locked) {
      return;
    }
    onPatch(pageIndex, next);
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

      <Section title="Background color">
        <Row label="Color">
          <label className="flow-page-properties-swatch">
            <span
              className="flow-page-properties-swatch-face"
              style={{ backgroundColor: background.color ? color : "#fff" }}
            />
            <input
              type="color"
              value={color}
              disabled={locked}
              aria-label="Page background color"
              onChange={(event) => patch({ color: event.target.value })}
            />
          </label>
        </Row>
        <Row label="Opacity">
          <span className="flow-page-properties-opacity">
            <input
              type="number"
              min={0}
              max={100}
              value={colorOpacity}
              disabled={locked || !background.color}
              aria-label="Background color opacity"
              onChange={(event) => {
                const n = Number(event.target.value);
                if (Number.isFinite(n)) {
                  patch({ colorOpacity: Math.max(0, Math.min(100, Math.round(n))) });
                }
              }}
            />
            <span>%</span>
          </span>
        </Row>
      </Section>

      <Section title="Background image">
        <Row label="Image">
          <button
            type="button"
            className="flow-page-properties-image-btn"
            disabled={locked}
            onClick={onImportBackground}
            aria-label={imageUrl ? "Replace background image" : "Import background image"}
            title={imageUrl ? "Replace background image" : "Import background image"}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" />
            ) : (
              <span className="flow-page-properties-no-image" aria-hidden>
                ⊘
              </span>
            )}
          </button>
        </Row>
        <Row label="Size">
          <select
            value={background.imageFit ?? "fill"}
            disabled={locked || !imageUrl}
            onChange={(event) => patch({ imageFit: event.target.value as PageBackgroundFit })}
          >
            {PAGE_BACKGROUND_FITS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Position">
          <select
            value={background.imagePosition ?? "top-left"}
            disabled={locked || !imageUrl}
            onChange={(event) =>
              patch({ imagePosition: event.target.value as PageBackgroundPosition })
            }
          >
            {PAGE_BACKGROUND_POSITIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Repeat">
          <select
            value={background.imageRepeat ? "repeat" : "no-repeat"}
            disabled={locked || !imageUrl}
            onChange={(event) => patch({ imageRepeat: event.target.value === "repeat" })}
          >
            <option value="no-repeat">No repeat</option>
            <option value="repeat">Repeat</option>
          </select>
        </Row>
        <Row label="Opacity">
          <span className="flow-page-properties-opacity">
            <input
              type="number"
              min={0}
              max={100}
              value={background.imageOpacity ?? 100}
              disabled={locked || !imageUrl}
              aria-label="Background image opacity"
              onChange={(event) => {
                const n = Number(event.target.value);
                if (Number.isFinite(n)) {
                  patch({ imageOpacity: Math.max(0, Math.min(100, Math.round(n))) });
                }
              }}
            />
            <span>%</span>
          </span>
        </Row>
      </Section>

      <Section title="Layout" chevron>
        <div className="flow-page-properties-layout">
          <p className="flow-page-properties-layout-name">{preset.label}</p>
          <p className="flow-page-properties-layout-size">
            {formatInches(widthIn)} in × {formatInches(heightIn)} in
          </p>
        </div>
      </Section>

      <Section title="Actions">
        <button
          type="button"
          className="flow-page-properties-action"
          disabled={locked}
          onClick={onDuplicate}
        >
          <span className="flow-page-properties-action-icon" aria-hidden>
            ▢+
          </span>
          Duplicate
        </button>
        {background.color || imageUrl ? (
          <button
            type="button"
            className="flow-page-properties-action flow-page-properties-action--muted"
            disabled={locked}
            onClick={() => onClear(pageIndex)}
          >
            Clear page background
          </button>
        ) : null}
      </Section>
    </aside>
  );
}

function Section({
  title,
  children,
  chevron,
}: {
  title: string;
  children: ReactNode;
  chevron?: boolean;
}) {
  return (
    <section className="flow-page-properties-section">
      <h3 className="flow-page-properties-section-title">
        {title}
        {chevron ? <span aria-hidden>›</span> : null}
      </h3>
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
