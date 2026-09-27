"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { PdfDocTypeIcon } from "@/components/documents/document-type-icon";
import type { EditorDoc } from "@/lib/editor/types";
import { assetUrl } from "@/lib/storage/asset-url";
import { SAMPLE_TEMPLATE_FOLDERS } from "@/lib/templates/sample-catalog";
import { formatRelativeTime } from "@/lib/ui/time";

export type PickedPdfTemplate = { id: string; name: string };

type PdfTemplateRow = {
  id: string;
  name: string;
  kind: string;
  updated_at: string;
  is_sample?: boolean;
  sample_folder_slug?: string | null;
  editor_json?: EditorDoc | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (template: PickedPdfTemplate) => void;
};

/** Rendered page images of an uploaded PDF, in page order. */
function pdfPageKeys(doc: EditorDoc | null | undefined): string[] {
  const keys: string[] = [];
  for (const node of doc?.content ?? []) {
    const bgKey = (node as { type?: string; attrs?: { bgKey?: unknown } }).attrs?.bgKey;
    if (node.type === "fieldCanvas" && typeof bgKey === "string" && bgKey) {
      keys.push(bgKey);
    }
  }
  return keys;
}

/** Only uploaded PDFs with rendered pages can start the delivery steps. */
function usablePdfs(templates: PdfTemplateRow[] | undefined): PdfTemplateRow[] {
  return (templates ?? []).filter((template) => template.kind === "PDF" && pdfPageKeys(template.editor_json).length > 0);
}

function sampleFolderName(slug: string | null | undefined): string {
  return SAMPLE_TEMPLATE_FOLDERS.find((folder) => folder.slug === slug)?.name ?? "Library Templates";
}

async function loadTemplates(url: string): Promise<PdfTemplateRow[]> {
  const response = await fetch(url);
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as { templates?: PdfTemplateRow[] };
  return usablePdfs(payload.templates);
}

export function PdfLibraryPickerModal({ open, onClose, onPick }: Props) {
  const [myTemplates, setMyTemplates] = useState<PdfTemplateRow[]>([]);
  const [masterTemplates, setMasterTemplates] = useState<PdfTemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [previewing, setPreviewing] = useState<PdfTemplateRow | null>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = Boolean(importStatus);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    setQuery("");
    setError(null);
    setImportStatus(null);
    setPreviewing(null);
    setLoading(true);
    void Promise.all([loadTemplates("/api/templates?limit=200"), loadTemplates("/api/templates/samples")])
      .then(([mine, masters]) => {
        if (!cancelled) {
          setMyTemplates(mine.filter((template) => !template.is_sample));
          setMasterTemplates(masters);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load your Library");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || busy) {
        return;
      }
      if (previewing) {
        setPreviewing(null);
        return;
      }
      onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose, open, previewing]);

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (template: PdfTemplateRow) => !needle || template.name.toLowerCase().includes(needle);
    return [
      { id: "mine", title: "My Library", templates: myTemplates.filter(matches) },
      { id: "masters", title: "Library Templates", templates: masterTemplates.filter(matches) },
    ];
  }, [masterTemplates, myTemplates, query]);

  function chooseTemplate(template: PdfTemplateRow) {
    onPick({ id: template.id, name: template.name });
  }

  async function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Choose a PDF file.");
      return;
    }
    setError(null);
    setImportStatus("Uploading PDF…");
    try {
      const { createTemplateFromFile } = await import("@/lib/templates/create-from-upload");
      const pdf = file.type === "application/pdf" ? file : new File([file], file.name, { type: "application/pdf" });
      const template = await createTemplateFromFile(pdf, (progress) => setImportStatus(progress.stage));
      onPick({ id: template.id, name: template.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF import failed");
    } finally {
      setImportStatus(null);
    }
  }

  if (!open || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-start justify-center bg-slate-900/40 p-4 ${
        previewing ? "pt-4" : "pt-16"
      }`}
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
        aria-labelledby="pdf-library-picker-title"
        className={`flex w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl ${
          previewing ? "h-[calc(100vh-2rem)] max-w-5xl" : "max-h-[85vh] max-w-2xl"
        }`}
      >
        {previewing ? (
          <PdfPreview
            template={previewing}
            onBack={() => setPreviewing(null)}
            onUse={() => chooseTemplate(previewing)}
            onClose={onClose}
          />
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
              <div>
                <h2 id="pdf-library-picker-title" className="text-sm font-semibold text-foreground">
                  New PDF
                </h2>
                <p className="mt-0.5 text-xs text-muted">
                  Pick a PDF from your Library or the Library Templates, or import a new one.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded px-2 py-1 text-sm text-muted hover:bg-slate-100 hover:text-foreground disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search PDFs…"
                aria-label="Search PDFs"
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-primary/40"
                disabled={busy}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy}
                className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60"
              >
                + Import PDF
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => void onFileChosen(event)}
              />
            </div>

            {importStatus || error ? (
              <p
                className={`px-4 pt-2 text-xs ${error ? "text-red-600" : "text-muted"}`}
                role={error ? "alert" : "status"}
              >
                {error ?? importStatus}
              </p>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              {loading ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Loading Library…</p>
              ) : (
                sections.map((section) => (
                  <section key={section.id} aria-label={section.title}>
                    <h3 className="sticky top-0 z-[1] border-b border-border bg-slate-50 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                      {section.title} ({section.templates.length})
                    </h3>
                    {section.templates.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-muted">
                        {query.trim()
                          ? "No PDFs match your search."
                          : section.id === "mine"
                            ? "No PDFs in your Library yet. Import one to get started."
                            : "No Library Templates available."}
                      </p>
                    ) : (
                      <ul>
                        {section.templates.map((template) => (
                          <li key={template.id} className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50">
                            <PdfDocTypeIcon size={20} />
                            <button
                              type="button"
                              onClick={() => setPreviewing(template)}
                              disabled={busy}
                              className="min-w-0 flex-1 text-left"
                            >
                              <span className="block truncate text-sm text-foreground">{template.name}</span>
                              <span className="block truncate text-xs text-muted">
                                {template.is_sample
                                  ? sampleFolderName(template.sample_folder_slug)
                                  : `Updated ${formatRelativeTime(template.updated_at)}`}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewing(template)}
                              disabled={busy}
                              aria-label={`Preview ${template.name}`}
                              title="Preview"
                              className="shrink-0 rounded-md p-1.5 text-muted hover:bg-slate-100 hover:text-foreground disabled:opacity-50"
                            >
                              <IconEye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => chooseTemplate(template)}
                              disabled={busy}
                              className="shrink-0 rounded-md border border-primary px-3 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                            >
                              Use
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function PdfPreview({
  template,
  onBack,
  onUse,
  onClose,
}: {
  template: PdfTemplateRow;
  onBack: () => void;
  onUse: () => void;
  onClose: () => void;
}) {
  const pages = pdfPageKeys(template.editor_json);
  return (
    <>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="shrink-0 rounded px-2 py-1 text-sm text-muted hover:bg-slate-100 hover:text-foreground"
        >
          ← Back
        </button>
        <div className="min-w-0 flex-1">
          <h2 id="pdf-library-picker-title" className="truncate text-sm font-semibold text-foreground">
            {template.name}
          </h2>
          <p className="text-xs text-muted">
            {pages.length} {pages.length === 1 ? "page" : "pages"}
            {template.is_sample ? ` · ${sampleFolderName(template.sample_folder_slug)}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onUse}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-95"
        >
          Use This Template
        </button>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded px-2 py-1 text-sm text-muted hover:bg-slate-100 hover:text-foreground"
        >
          Close
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-slate-100 px-4 py-6 sm:px-8">
        {pages.map((key, index) => (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated upload route, not optimizable
          <img
            key={key}
            src={assetUrl(key)}
            alt={`${template.name} page ${index + 1}`}
            loading="lazy"
            className="mx-auto block w-full max-w-[850px] bg-white shadow-md"
          />
        ))}
      </div>
    </>
  );
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.75" />
    </svg>
  );
}
