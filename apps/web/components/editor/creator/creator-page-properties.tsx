"use client";

import type { ReactNode } from "react";
import type { Editor } from "@tiptap/core";
import { useEditorEventTick } from "@/components/editor/hooks/use-editor-event-tick";
import { assetUrl } from "@/lib/storage/asset-url";
import {
  backgroundForPage,
  formatInches,
  PAGE_BACKGROUND_FITS,
  PAGE_BACKGROUND_POSITIONS,
  parsePageBackgrounds,
  type PageBackground,
  type PageBackgroundFit,
  type PageBackgroundPosition,
} from "@/lib/editor/page-backgrounds";
import { pageSizeSpec, type PageSizeId } from "@/lib/editor/page-geometry";
import { IconBan, IconClose, IconImage } from "./creator-icons";

type Props = {
  editor: Editor | null;
  currentPage: number;
  pageSize: PageSizeId;
  onClose: () => void;
  onImportBackground: () => void;
};

export function CreatorPagePropertiesPanel({
  editor,
  currentPage,
  pageSize,
  onClose,
  onImportBackground,
}: Props) {
  const tick = useEditorEventTick(editor);
  void tick;
  const spec = pageSizeSpec(pageSize);
  const pageIndex = Math.max(0, currentPage - 1);
  const background = backgroundForPage(
    parsePageBackgrounds(editor?.state.doc.attrs.pageBackgrounds),
    pageIndex,
  );
  const color = background.color ?? "#ffffff";
  const colorOpacity = background.colorOpacity ?? 100;
  const imageUrl = background.imageKey ? assetUrl(background.imageKey) : null;

  function patch(next: Partial<PageBackground>) {
    editor?.commands.setPageBackground(pageIndex, next);
  }

  return (
    <aside className="flex h-full w-72 max-w-72 shrink-0 flex-col overflow-y-auto border-l border-border bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Page properties</h2>
          <p className="text-[11px] text-muted">Page {currentPage}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md p-1 text-muted hover:bg-slate-100 hover:text-foreground"
          aria-label="Close page properties"
        >
          <IconClose className="h-4 w-4" />
        </button>
      </div>

      <Section title="Background color">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">Color</span>
          <label className="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center">
            <span
              className="h-7 w-7 rounded-full border border-slate-200 shadow-inner"
              style={{ backgroundColor: background.color ? color : "transparent" }}
            />
            {!background.color ? (
              <span className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%),linear-gradient(45deg,#e2e8f0_25%,transparent_25%,transparent_75%,#e2e8f0_75%)] bg-[length:8px_8px] bg-[position:0_0,4px_4px]" />
            ) : null}
            <input
              type="color"
              value={color}
              aria-label="Page background color"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(event) => patch({ color: event.target.value })}
            />
          </label>
        </div>
        <OpacityRow
          value={colorOpacity}
          disabled={!background.color}
          onChange={(value) => patch({ colorOpacity: value })}
        />
      </Section>

      <Section title="Background image">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">Image</span>
          <button
            type="button"
            onClick={onImportBackground}
            className="relative h-9 w-9 overflow-hidden rounded-md border border-slate-200 bg-slate-50"
            aria-label={imageUrl ? "Replace background image" : "Import background image"}
            title={imageUrl ? "Replace background image" : "Import background image"}
          >
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-slate-400">
                <IconBan className="h-4 w-4" />
              </span>
            )}
          </button>
        </div>
        <SelectRow
          label="Size"
          value={background.imageFit ?? "fill"}
          disabled={!imageUrl}
          options={PAGE_BACKGROUND_FITS}
          onChange={(value) => patch({ imageFit: value as PageBackgroundFit })}
        />
        <SelectRow
          label="Position"
          value={background.imagePosition ?? "top-left"}
          disabled={!imageUrl}
          options={PAGE_BACKGROUND_POSITIONS}
          onChange={(value) => patch({ imagePosition: value as PageBackgroundPosition })}
        />
        <SelectRow
          label="Repeat"
          value={background.imageRepeat ? "repeat" : "no-repeat"}
          disabled={!imageUrl}
          options={[
            { id: "no-repeat", label: "No repeat" },
            { id: "repeat", label: "Repeat" },
          ]}
          onChange={(value) => patch({ imageRepeat: value === "repeat" })}
        />
        <OpacityRow
          value={background.imageOpacity ?? 100}
          disabled={!imageUrl}
          onChange={(value) => patch({ imageOpacity: value })}
        />
        <div className="flex flex-col gap-1.5 pt-1">
          <button
            type="button"
            onClick={onImportBackground}
            className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-slate-50"
          >
            <IconImage className="h-3.5 w-3.5" />
            {imageUrl ? "Replace image" : "Import image"}
          </button>
          {imageUrl ? (
            <button
              type="button"
              onClick={() => patch({ imageKey: null })}
              className="rounded-md px-3 py-1.5 text-xs text-muted hover:bg-slate-50 hover:text-foreground"
            >
              Remove image
            </button>
          ) : null}
        </div>
      </Section>

      <Section title="Layout">
        <div className="rounded-md border border-border bg-background px-3 py-2">
          <p className="text-sm font-medium text-foreground">{spec.shortLabel}</p>
          <p className="text-[11px] text-muted">
            {formatInches(spec.widthPx / 96)} in × {formatInches(spec.heightPx / 96)} in
          </p>
        </div>
      </Section>

      {background.color || imageUrl ? (
        <div className="px-4 pb-4">
          <button
            type="button"
            onClick={() => editor?.commands.clearPageBackground(pageIndex)}
            className="w-full rounded-md border border-border bg-slate-50 px-3 py-2 text-xs font-medium text-foreground hover:bg-slate-100"
          >
            Clear page background
          </button>
        </div>
      ) : null}
    </aside>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-border px-4 py-3">
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-muted">{title}</h3>
      <div className="flex flex-col gap-2.5">{children}</div>
    </section>
  );
}

function OpacityRow({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className={`flex items-center justify-between gap-3 ${disabled ? "opacity-40" : ""}`}>
      <span className="text-xs text-muted">Opacity</span>
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-1 w-full accent-primary"
        />
        <span className="w-10 text-right text-[11px] tabular-nums text-muted">{value} %</span>
      </span>
    </label>
  );
}

function SelectRow({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`flex items-center justify-between gap-3 ${disabled ? "opacity-40" : ""}`}>
      <span className="text-xs text-muted">{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="max-w-[9.5rem] rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground outline-none ring-primary/15 focus:ring-2 disabled:cursor-not-allowed"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
