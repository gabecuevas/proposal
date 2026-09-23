"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@repo/ui/utils";
import { assetUrl } from "@/lib/storage/asset-url";

/** On-document display box (matches Quote/Invoice screenshots). */
export const COMPANY_LOGO_DISPLAY_WIDTH = 264;
export const COMPANY_LOGO_DISPLAY_HEIGHT = 144;

/** Suggested upload size (2× display for crisp retina). */
export const COMPANY_LOGO_SUGGESTED_WIDTH = 528;
export const COMPANY_LOGO_SUGGESTED_HEIGHT = 288;
export const COMPANY_LOGO_SUGGESTED_SIZE = `${COMPANY_LOGO_SUGGESTED_WIDTH}×${COMPANY_LOGO_SUGGESTED_HEIGHT}px`;

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

type Props = {
  open: boolean;
  currentLogoKey?: string | null;
  busy?: boolean;
  title?: string;
  onClose: () => void;
  onUploaded: (key: string) => void | Promise<void>;
};

export function CompanyLogoModal({
  open,
  currentLogoKey,
  busy,
  title = "Company logo",
  onClose,
  onUploaded,
}: Props) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setError(null);
    setPendingFile(null);
    setNaturalSize(null);
    setPreviewUrl(currentLogoKey ? assetUrl(currentLogoKey) : null);
  }, [currentLogoKey, open]);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !uploading && !busy) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose, open, uploading]);

  function chooseFile(file: File | undefined) {
    setError(null);
    if (!file) {
      return;
    }
    if (!ALLOWED.has(file.type)) {
      setError("Use a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("Logo must be 2MB or smaller.");
      return;
    }
    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    const url = URL.createObjectURL(file);
    setPendingFile(file);
    setPreviewUrl(url);
    const img = new Image();
    img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }

  async function upload() {
    if (!pendingFile) {
      onClose();
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append("file", pendingFile);
      const response = await fetch("/api/uploads", { method: "POST", body });
      if (!response.ok) {
        throw new Error("Upload failed");
      }
      const payload = (await response.json()) as { upload?: { key?: string } };
      const key = payload.upload?.key;
      if (!key) {
        throw new Error("Upload response missing key");
      }
      await onUploaded(key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  if (!open) {
    return null;
  }

  const disabled = Boolean(busy || uploading);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/40 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !disabled) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id={titleId} className="text-sm font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={disabled}
            className="rounded-md px-2 py-1 text-sm text-muted hover:bg-slate-100 disabled:opacity-40"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <p className="text-sm text-muted">
            Suggested upload size: <span className="font-medium text-foreground">{COMPANY_LOGO_SUGGESTED_SIZE}</span>{" "}
            (PNG, JPEG, or WebP). The logo is shown at {COMPANY_LOGO_DISPLAY_WIDTH}×
            {COMPANY_LOGO_DISPLAY_HEIGHT}px and keeps its aspect ratio—never stretched.
          </p>

          <div
            className={cn(
              "mx-auto flex items-center justify-center overflow-hidden",
              previewUrl
                ? "border-0 bg-transparent"
                : "rounded-md border border-dashed border-border bg-transparent",
            )}
            style={{ width: COMPANY_LOGO_DISPLAY_WIDTH, height: COMPANY_LOGO_DISPLAY_HEIGHT }}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Logo preview" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-sm text-muted">Preview</span>
            )}
          </div>

          {naturalSize ? (
            <p className="text-center text-xs text-muted">
              Selected image: {naturalSize.w}×{naturalSize.h}px
              {naturalSize.w > COMPANY_LOGO_SUGGESTED_WIDTH * 2 ||
              naturalSize.h > COMPANY_LOGO_SUGGESTED_HEIGHT * 2
                ? " (larger than needed — still OK; it will scale down cleanly)"
                : ""}
            </p>
          ) : null}

          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              void chooseFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              className="rounded-md border border-border bg-white px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-40"
            >
              Choose image
            </button>
            <button
              type="button"
              disabled={disabled || !pendingFile}
              onClick={() => void upload()}
              className={cn(
                "rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40",
              )}
            >
              {uploading ? "Uploading…" : "Use this logo"}
            </button>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
