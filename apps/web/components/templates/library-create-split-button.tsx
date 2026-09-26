"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@repo/ui/utils";
import { IconChevronDown, IconTemplates } from "@/components/app-shell/shell-icons";
import {
  FlowDocTypeIcon,
  PdfDocTypeIcon,
  QuoteDocTypeIcon,
} from "@/components/documents/document-type-icon";
import {
  DOCUMENT_CREATE_KINDS,
  documentKindProfile,
  type DocumentCreateKind,
} from "@/lib/editor/document-kind";

const MENU_ICON_SIZE = 20;

const KIND_ICONS: Record<DocumentCreateKind, ReactNode> = {
  document: <FlowDocTypeIcon size={MENU_ICON_SIZE} />,
  template: <IconTemplates className="h-5 w-5 shrink-0 text-muted" />,
  proposal: <FlowDocTypeIcon size={MENU_ICON_SIZE} title="Proposal" />,
  quote: <QuoteDocTypeIcon size={MENU_ICON_SIZE} />,
  invoice: <QuoteDocTypeIcon size={MENU_ICON_SIZE} title="Invoice" />,
};

type Props = {
  primaryKind?: DocumentCreateKind;
  onSelect: (kind: DocumentCreateKind) => void;
  className?: string;
  /** Compact styling for toolbars vs full-width sidebar CTA. */
  variant?: "sidebar" | "toolbar";
  /** Library folder that "New PDF" uploads land in. */
  folderId?: string | null;
};

export function LibraryCreateSplitButton({
  primaryKind = "document",
  onSelect,
  className,
  variant = "sidebar",
  folderId = null,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const primary = documentKindProfile(primaryKind);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function onPdfChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setPdfError("Choose a PDF file.");
      return;
    }
    setPdfError(null);
    setPdfStatus("Uploading PDF…");
    try {
      const { createTemplateFromFile } = await import("@/lib/templates/create-from-upload");
      const pdf = file.type === "application/pdf" ? file : new File([file], file.name, { type: "application/pdf" });
      const template = await createTemplateFromFile(pdf, (progress) => setPdfStatus(progress.stage), {
        folderId,
      });
      router.push(`/app/templates/${template.id}`);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "PDF upload failed");
    } finally {
      setPdfStatus(null);
    }
  }

  const isSidebar = variant === "sidebar";
  const menuItemClass =
    "flex w-full items-center gap-2.5 whitespace-nowrap px-3 py-1.5 text-left hover:bg-slate-50";

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex overflow-hidden rounded-md bg-primary text-primary-foreground shadow-sm",
          isSidebar ? "w-full" : "inline-flex",
        )}
      >
        <button
          type="button"
          onClick={() => onSelect(primaryKind)}
          className={cn(
            "flex min-w-0 flex-1 items-center justify-center gap-2 font-medium transition-opacity hover:opacity-95",
            isSidebar ? "px-3 py-2.5 text-sm" : "h-8 px-3 text-xs",
          )}
        >
          <span className="text-base leading-none">+</span>
          <span className="truncate">{primary.label}</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "inline-flex items-center justify-center border-l border-primary-foreground/20 transition-opacity hover:opacity-95",
            isSidebar ? "px-2.5" : "h-8 w-8",
            open && "bg-primary-foreground/10",
          )}
          aria-label="More create options"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          <IconChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <input
        ref={pdfInputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(event) => void onPdfChosen(event)}
      />

      {pdfStatus || pdfError ? (
        <p
          className={cn("mt-1 text-[11px]", pdfError ? "text-red-600" : "text-muted", !isSidebar && "absolute right-0 whitespace-nowrap")}
          role={pdfError ? "alert" : "status"}
        >
          {pdfError ?? pdfStatus}
        </p>
      ) : null}

      {open ? (
        <div
          role="menu"
          className={cn(
            "absolute left-0 z-50 mt-1 min-w-full overflow-hidden rounded-md border border-border bg-white py-1 text-sm text-foreground shadow-lg",
            !isSidebar && "right-0 left-auto min-w-[11rem]",
          )}
        >
          {DOCUMENT_CREATE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onSelect(kind);
              }}
              className={menuItemClass}
            >
              {KIND_ICONS[kind]}
              {documentKindProfile(kind).label}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            disabled={Boolean(pdfStatus)}
            onClick={() => {
              setOpen(false);
              pdfInputRef.current?.click();
            }}
            className={cn(menuItemClass, "disabled:opacity-50")}
          >
            <PdfDocTypeIcon size={MENU_ICON_SIZE} />
            New PDF
          </button>
        </div>
      ) : null}
    </div>
  );
}
