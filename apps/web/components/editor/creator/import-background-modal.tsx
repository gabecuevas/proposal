"use client";

import type { Editor } from "@tiptap/core";
import { useEffect, useRef, useState } from "react";
import { isSupportedImage, uploadAsset } from "@/lib/editor/insert-elements";
import {
  assessBackgroundImage,
  BACKGROUND_IMAGE_EXTENSIONS,
  backgroundImageRequirements,
  formatInches,
  formatMb,
} from "@/lib/editor/page-backgrounds";
import { type PageSizeId } from "@/lib/editor/page-geometry";
import { readImageDimensions } from "@/lib/pdf/rasterize";
import { IconClose, IconImage } from "./creator-icons";

type Props = {
  open: boolean;
  editor: Editor | null;
  currentPage: number;
  pageSize: PageSizeId;
  onClose: () => void;
};

export function ImportBackgroundModal({ open, editor, currentPage, pageSize, onClose }: Props) {
  const req = backgroundImageRequirements(pageSize);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setFile(null);
    setPreviewUrl("");
    setErrors([]);
    setWarnings([]);
    setBusy(false);
    setStatus("");
  }, [open]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  if (!open) {
    return null;
  }

  async function chooseFile(next: File | undefined) {
    if (!next) {
      return;
    }
    setStatus("");
    if (!isSupportedImage(next)) {
      setFile(null);
      setPreviewUrl("");
      setErrors([`Use a ${req.typesLabel} file.`]);
      setWarnings([]);
      return;
    }
    try {
      const size = await readImageDimensions(next);
      const assessment = assessBackgroundImage({
        type: next.type,
        bytes: next.size,
        width: size.width,
        height: size.height,
        pageSize,
      });
      setErrors(assessment.errors);
      setWarnings(assessment.warnings);
      setStatus(`Selected image: ${size.width} × ${size.height} px (${formatFileSize(next.size)}).`);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(URL.createObjectURL(next));
      setFile(assessment.ok ? next : null);
    } catch {
      setFile(null);
      setErrors(["Could not read that image. Try a PNG, JPEG, or WebP file."]);
      setWarnings([]);
    }
  }

  async function apply() {
    if (!file || !editor || busy) {
      return;
    }
    setBusy(true);
    setStatus("Uploading…");
    try {
      const asset = await uploadAsset(file);
      editor.commands.setPageBackground(Math.max(0, currentPage - 1), {
        imageKey: asset.key,
        imageFit: "fill",
        imagePosition: "top-left",
        imageRepeat: false,
        imageOpacity: 100,
      });
      onClose();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/40 p-4 pt-20"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-background-title"
        className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="import-background-title" className="text-sm font-semibold text-foreground">
            Import background image
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md p-1 text-muted hover:bg-slate-100 hover:text-foreground disabled:opacity-40"
            aria-label="Close import background"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <p className="text-sm text-muted">
            This fills <span className="font-medium text-foreground">page {currentPage}</span> as a
            background layer. Text, elements, and fillable fields stay on top and keep their usual
            editing and signing behavior.
          </p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Image requirements
            </p>
            <ul className="mt-2 space-y-1 text-xs leading-5 text-slate-700">
              <li>
                Page size: <strong>{req.pageLabel}</strong>
              </li>
              <li>
                Best print quality (300 DPI):{" "}
                <strong>
                  {req.print300Px.width} × {req.print300Px.height} px
                </strong>
              </li>
              <li>
                Good quality (150 DPI):{" "}
                <strong>
                  {req.print150Px.width} × {req.print150Px.height} px
                </strong>
              </li>
              <li>
                Minimum (matches the on-screen page):{" "}
                <strong>
                  {req.screenPx.width} × {req.screenPx.height} px
                </strong>
              </li>
              <li>
                Aspect ratio:{" "}
                <strong>
                  {formatInches(req.widthIn)} × {formatInches(req.heightIn)} in
                </strong>
              </li>
              <li>
                File type: <strong>{req.typesLabel}</strong>
              </li>
              <li>
                Maximum size: <strong>{formatMb(req.maxBytes)} MB</strong> recommended,{" "}
                {formatMb(req.hardMaxBytes)} MB hard limit
              </li>
            </ul>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
            }}
            onDrop={(event) => {
              event.preventDefault();
              void chooseFile(event.dataTransfer.files[0]);
            }}
            className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-background px-4 py-6 text-center hover:border-primary/40 hover:bg-slate-50 disabled:opacity-40"
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="" className="mb-3 max-h-40 rounded-md border border-border object-contain" />
            ) : (
              <IconImage className="mb-2 h-6 w-6 text-slate-400" />
            )}
            <span className="text-sm font-medium text-foreground">
              {file ? file.name : "Drop an image here or click to browse"}
            </span>
            <span className="mt-1 text-[11px] text-muted">
              PNG, JPEG, or WebP · designed for {formatInches(req.widthIn)} × {formatInches(req.heightIn)} in
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept={BACKGROUND_IMAGE_EXTENSIONS}
            className="hidden"
            onChange={(event) => {
              void chooseFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          {errors.length
            ? errors.map((message) => (
                <p key={message} className="text-xs text-red-600">
                  {message}
                </p>
              ))
            : null}
          {warnings.length
            ? warnings.map((message) => (
                <p key={message} className="text-xs text-amber-700">
                  {message}
                </p>
              ))
            : null}
          {status ? (
            <p className={`text-xs ${status.startsWith("Selected") || status === "Uploading…" ? "text-muted" : "text-red-600"}`}>
              {status}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-slate-50 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !file || !editor}
            onClick={() => void apply()}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-40"
          >
            {busy ? "Uploading…" : "Add background"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
