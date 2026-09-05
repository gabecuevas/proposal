"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  ACCEPTED_UPLOAD_EXTENSIONS,
  createTemplateFromFile,
  isDocxUpload,
  isSupportedUpload,
  type UploadProgress,
} from "@/lib/templates/create-from-upload";
import { buildPageBackedEditorDoc } from "@/lib/editor/pdf-template";
import { rasterizePdf } from "@/lib/pdf/rasterize";

type Props = {
  onUploaded: () => void;
  folderId?: string | null;
};

type DocxMode = "pdf" | "editor" | "both";

function decodePdfBase64(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: "application/pdf" });
}

async function fetchDocxConversion(file: File, mode: DocxMode): Promise<{
  baseName: string;
  editor_json?: unknown;
  pdfBase64?: string;
}> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`/api/templates/from-docx?mode=${mode}`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    let message = "Could not convert Word document.";
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) {
        message = payload.error;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await response.json()) as {
    baseName: string;
    editor_json?: unknown;
    pdfBase64?: string;
  };
}

async function uploadPageBlob(blob: Blob, fileName: string): Promise<string> {
  const form = new FormData();
  form.append("file", new File([blob], fileName, { type: blob.type }));
  const response = await fetch("/api/uploads", { method: "POST", body: form });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    };
    throw new Error(payload?.error?.message ?? "Upload failed");
  }
  const payload = (await response.json()) as { upload: { key: string } };
  return payload.upload.key;
}

async function createTemplateFromPdfPages(
  pages: Array<{ key: string; pageNumber: number; width: number; height: number }>,
  name: string,
  options?: { folderId?: string | null; tags?: string[] },
): Promise<{ id: string; name: string }> {
  const editor_json = buildPageBackedEditorDoc(pages);
  const response = await fetch("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      editor_json,
      tags: options?.tags ?? ["uploaded", "pdf"],
      folder_id: options?.folderId ?? null,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to create PDF template");
  }
  const payload = (await response.json()) as { template?: { id: string; name: string } };
  return payload.template ?? { id: "unknown", name };
}

async function createTemplateFromEditorJson(
  editor_json: unknown,
  name: string,
  options?: { folderId?: string | null; tags?: string[] },
): Promise<{ id: string; name: string }> {
  const response = await fetch("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      editor_json,
      tags: options?.tags ?? ["uploaded", "docx"],
      folder_id: options?.folderId ?? null,
    }),
  });
  if (!response.ok) {
    throw new Error("Failed to create editable template");
  }
  const payload = (await response.json()) as { template?: { id: string; name: string } };
  return payload.template ?? { id: "unknown", name };
}

async function createTemplateFromPdfBlob(
  pdfBlob: Blob,
  name: string,
  onProgress: (progress: UploadProgress) => void,
  options?: { folderId?: string | null; tags?: string[] },
): Promise<{ id: string; name: string }> {
  const pdfFile = new File([pdfBlob], `${name}.pdf`, { type: "application/pdf" });
  const rendered = await rasterizePdf(pdfFile, (done, total) => {
    onProgress({
      fileName: name,
      stage: `Rendering page ${done} of ${total}…`,
      ratio: 0.4 + (done / Math.max(1, total)) * 0.55,
    });
  });

  const pages: Array<{ key: string; pageNumber: number; width: number; height: number }> = [];
  for (const page of rendered) {
    const key = await uploadPageBlob(page.blob, `page-${page.pageNumber}.jpg`);
    pages.push({
      key,
      pageNumber: page.pageNumber,
      width: page.width,
      height: page.height,
    });
  }
  return createTemplateFromPdfPages(pages, name, options);
}

function DocxImportModal({
  open,
  file,
  busy,
  onClose,
  onMode,
}: {
  open: boolean;
  file: File | null;
  busy: boolean;
  onClose: () => void;
  onMode: (mode: DocxMode) => Promise<void>;
}) {
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
  }, [onClose, open]);

  if (!open || !file) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 shadow-xl">
        <h3 className="text-base font-semibold text-foreground">Import Document Type</h3>
        <p className="mt-1 text-sm text-muted">
          How should we handle <span className="font-medium text-foreground">{file.name}</span>?
        </p>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onMode("pdf")}
            className="group w-full rounded-md border border-border bg-surface px-3 py-2.5 text-left text-sm transition-colors hover:border-primary hover:bg-primary disabled:opacity-60"
          >
            <span className="font-medium text-foreground group-hover:text-primary-foreground">
              Convert to PDF
            </span>
            <span className="mt-0.5 block text-xs text-muted group-hover:text-primary-foreground/80">
              Rasterize into page images so you can place fields on the pages.
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onMode("editor")}
            className="group w-full rounded-md border border-border bg-surface px-3 py-2.5 text-left text-sm transition-colors hover:border-primary hover:bg-primary disabled:opacity-60"
          >
            <span className="font-medium text-foreground group-hover:text-primary-foreground">
              Import as Docx
            </span>
            <span className="mt-0.5 block text-xs text-muted group-hover:text-primary-foreground/80">
              Create an editable document with paragraphs, headings, and lists.
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onMode("both")}
            className="group w-full rounded-md border border-border bg-surface px-3 py-2.5 text-left text-sm transition-colors hover:border-primary hover:bg-primary disabled:opacity-60"
          >
            <span className="font-medium text-foreground group-hover:text-primary-foreground">Both</span>
            <span className="mt-0.5 block text-xs text-muted group-hover:text-primary-foreground/80">
              Convert to PDF and also create an editable import.
            </span>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          {busy ? "Close" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

export function UploadDropzone({ onUploaded, folderId = null }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState("");
  const [docxModalOpen, setDocxModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [expanded, setExpanded] = useState(true);

  const handleFiles = useCallback(
    async (fileList: FileList | null) => {
      const files = Array.from(fileList ?? []);
      if (files.length === 0) {
        return;
      }

      const unsupported = files.filter((file) => !isSupportedUpload(file));
      const supported = files.filter(isSupportedUpload);

      setError(
        unsupported.length > 0
          ? `Skipped ${unsupported.map((file) => file.name).join(", ")} — only PDF, JPG, PNG, WebP, and DOCX are supported.`
          : "",
      );

      if (supported.length === 0) {
        return;
      }

      const docxFiles = supported.filter(isDocxUpload);
      const otherFiles = supported.filter((file) => !isDocxUpload(file));

      if (otherFiles.length > 0) {
        setBusy(true);
        setExpanded(true);
        try {
          for (const file of otherFiles) {
            await createTemplateFromFile(file, setProgress, { folderId });
          }
          onUploaded();
        } catch (uploadError) {
          setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
        } finally {
          setBusy(false);
          setProgress(null);
          if (inputRef.current) {
            inputRef.current.value = "";
          }
        }
      }

      if (docxFiles.length > 0) {
        setPendingFile(docxFiles[0] ?? null);
        setDocxModalOpen(true);
      }
    },
    [folderId, onUploaded],
  );

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (!busy) {
      void handleFiles(event.dataTransfer.files);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!busy) {
      setDragging(true);
    }
  }

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFiles(event.target.files);
  }

  async function openDocxMode(mode: DocxMode) {
    if (!pendingFile) {
      return;
    }
    setBusy(true);
    setExpanded(true);
    try {
      const name =
        pendingFile.name.replace(/\.docx$/i, "").trim() || pendingFile.name.trim() || "document";
      const result = await fetchDocxConversion(pendingFile, mode);
      let pdfTemplateId: string | null = null;
      let editorTemplateId: string | null = null;

      if (mode === "pdf" || mode === "both") {
        if (!result.pdfBase64) {
          throw new Error("DOCX conversion failed: PDF missing");
        }
        const pdfTemplate = await createTemplateFromPdfBlob(
          decodePdfBase64(result.pdfBase64),
          name,
          setProgress,
          { folderId, tags: ["uploaded", "pdf"] },
        );
        pdfTemplateId = pdfTemplate.id;
      }

      if (mode === "editor" || mode === "both") {
        if (!result.editor_json) {
          throw new Error("DOCX import failed: editor content missing");
        }
        const editorTemplate = await createTemplateFromEditorJson(result.editor_json, name, {
          folderId,
          tags: ["uploaded", "docx"],
        });
        editorTemplateId = editorTemplate.id;
      }

      onUploaded();
      // Prefer the editable import when available so users can continue editing immediately.
      const targetId = editorTemplateId ?? pdfTemplateId;
      if (targetId) {
        router.push(`/app/templates/${targetId}`);
      }
      setDocxModalOpen(false);
      setPendingFile(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={() => {
          if (!busy) {
            setExpanded((open) => !open);
          }
        }}
        className="inline-flex items-center gap-1.5 text-left"
        aria-expanded={expanded}
        disabled={busy}
      >
        <h2 className="text-sm font-semibold text-foreground">Upload a file</h2>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          className={`shrink-0 text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {expanded ? (
        <>
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={() => setDragging(false)}
            className={`rounded-lg border border-dashed px-6 py-10 text-center transition-colors ${
              dragging ? "border-primary bg-primary/[0.04]" : "border-border bg-surface"
            }`}
          >
            {busy ? (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  {progress?.fileName ?? "Preparing upload…"}
                </p>
                <p className="text-sm text-muted">{progress?.stage ?? "Working…"}</p>
                <div
                  className="mx-auto h-1.5 w-64 overflow-hidden rounded-full bg-slate-200"
                  style={{ width: `${Math.round((progress?.ratio ?? 0.05) * 100)}%` }}
                >
                  <div className="h-full rounded-full bg-primary transition-[width] duration-300" />
                </div>
              </div>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">
                  Drag and drop one or multiple files
                </p>
                <p className="mt-1 text-xs text-muted">
                  PDF, JPG, PNG, WebP, or DOCX · up to 25MB each
                </p>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-95"
                >
                  Select files
                </button>
                <p className="mt-3 text-xs text-muted">
                  Multi-page PDFs become one editable page per sheet. Google Docs export as .docx.
                </p>
              </>
            )}

            <input
              ref={inputRef}
              type="file"
              multiple
              accept={ACCEPTED_UPLOAD_EXTENSIONS}
              onChange={onChange}
              className="hidden"
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </>
      ) : null}

      <DocxImportModal
        open={docxModalOpen}
        file={pendingFile}
        busy={busy}
        onClose={() => {
          setDocxModalOpen(false);
          setPendingFile(null);
          setBusy(false);
          setProgress(null);
        }}
        onMode={openDocxMode}
      />
    </section>
  );
}
