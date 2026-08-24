"use client";

import { IconDocBadge, IconPlus } from "./creator-icons";

type Props = {
  name: string;
  pageCount: number;
  currentPage: number;
  pageSizeLabel?: string;
  onAddPage?: () => void;
};

export function CreatorPageStrip({ name, pageCount, currentPage, pageSizeLabel, onAddPage }: Props) {
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
      <button
        type="button"
        onClick={onAddPage}
        className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded text-muted hover:bg-slate-100 hover:text-foreground"
        aria-label="Add page"
      >
        <IconPlus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
