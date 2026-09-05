"use client";

import { IconDocBadge, IconDownload, IconEye, IconPlus } from "./creator-icons";

type Props = {
  name: string;
  pageCount: number;
  currentPage: number;
  pageSizeLabel?: string;
  onAddPage?: () => void;
  onPreviewPdf?: () => void;
  onDownloadPdf?: () => void;
  pdfBusy?: boolean;
};

export function CreatorPageStrip({
  name,
  pageCount,
  currentPage,
  pageSizeLabel,
  onAddPage,
  onPreviewPdf,
  onDownloadPdf,
  pdfBusy = false,
}: Props) {
  const stripButtonClass =
    "inline-flex h-6 w-6 items-center justify-center rounded border border-border bg-slate-50 text-muted hover:bg-slate-100 hover:text-foreground disabled:opacity-50";

  return (
    <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 text-xs text-muted">
      <IconDocBadge className="h-3.5 w-3.5 text-primary" />
      <span className="truncate font-medium text-foreground">{name}</span>
      <span aria-hidden>·</span>
      <span>
        Page {currentPage} of {pageCount}
      </span>
      {pageSizeLabel ? (
        <>
          <span aria-hidden>·</span>
          <span className="hidden sm:inline">{pageSizeLabel}</span>
        </>
      ) : (
        <span className="hidden text-muted sm:inline">Cover page</span>
      )}
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          onClick={onPreviewPdf}
          disabled={!onPreviewPdf || pdfBusy}
          className={stripButtonClass}
          aria-label="Preview PDF"
          title="Preview PDF"
        >
          <IconEye className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onDownloadPdf}
          disabled={!onDownloadPdf || pdfBusy}
          className={stripButtonClass}
          aria-label="Download PDF"
          title="Download PDF"
        >
          <IconDownload className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onAddPage}
          className={stripButtonClass}
          aria-label="Add page"
          title="Add page"
        >
          <IconPlus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
