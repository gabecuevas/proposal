"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@repo/ui/utils";
import { CommercialDocumentCanvas } from "./commercial-document-canvas";
import {
  createBlankCommercialDocument,
  type CommercialDocType,
  type CommercialDocument,
} from "@/lib/commercial/schema";
import type { CommercialDocumentRecord } from "@/lib/commercial/store";

type Props = {
  open: boolean;
  type: CommercialDocType;
  documentId: string | null;
  onClose: () => void;
  onDocumentId: (id: string) => void;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function CommercialBuilderModal({ open, type, documentId, onClose, onDocumentId }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const dirtyRef = useRef(false);
  const createLockRef = useRef(false);
  const [commercial, setCommercial] = useState<CommercialDocument>(() =>
    createBlankCommercialDocument(type),
  );
  const [version, setVersion] = useState(1);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const idempotencyKeyRef = useRef(`cm-${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  const applyRecord = useCallback((document: CommercialDocumentRecord) => {
    setCommercial(document.commercial);
    setVersion(document.doc_version);
    dirtyRef.current = false;
    setStatus("saved");
    onDocumentId(document.id);
  }, [onDocumentId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    dirtyRef.current = false;
    setError(null);
    setConfirmClose(false);
    setStatus("idle");
    idempotencyKeyRef.current = `cm-${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    let cancelled = false;
    async function boot() {
      if (documentId) {
        const response = await fetch(`/api/commercial/documents/${documentId}`);
        if (!response.ok) {
          if (!cancelled) {
            setError("Could not load document");
          }
          return;
        }
        const payload = (await response.json()) as { document: CommercialDocumentRecord };
        if (!cancelled) {
          applyRecord(payload.document);
        }
        return;
      }
      // Do not create a DB row until the user edits or explicitly saves.
      if (!cancelled) {
        setCommercial(createBlankCommercialDocument(type));
        setVersion(1);
      }
    }
    void boot();
    const t = window.setTimeout(() => closeRef.current?.focus(), 30);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [applyRecord, documentId, open, type]);

  const ensurePersisted = useCallback(async (): Promise<CommercialDocumentRecord | null> => {
    if (documentId) {
      const response = await fetch(`/api/commercial/documents/${documentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedVersion: version, commercial }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string }; message?: string };
        throw new Error(payload.error?.message || payload.message || "Save failed");
      }
      const payload = (await response.json()) as { document: CommercialDocumentRecord };
      applyRecord(payload.document);
      return payload.document;
    }

    if (createLockRef.current) {
      return null;
    }
    createLockRef.current = true;
    try {
      const response = await fetch("/api/commercial/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          idempotencyKey: idempotencyKeyRef.current,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
          message?: string;
        };
        throw new Error(payload.error?.message || payload.message || "Could not create draft");
      }
      const created = (await response.json()) as { document: CommercialDocumentRecord };
      const withEdits = {
        ...created.document.commercial,
        ...commercial,
        documentNumber: commercial.documentNumber || created.document.commercial.documentNumber,
        type,
        schema: "commercial_v1" as const,
      };
      const patch = await fetch(`/api/commercial/documents/${created.document.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedVersion: created.document.doc_version,
          commercial: withEdits,
        }),
      });
      if (!patch.ok) {
        throw new Error("Could not save draft");
      }
      const payload = (await patch.json()) as { document: CommercialDocumentRecord };
      applyRecord(payload.document);
      return payload.document;
    } finally {
      createLockRef.current = false;
    }
  }, [applyRecord, commercial, documentId, type, version]);

  useEffect(() => {
    if (!open || !dirtyRef.current || !documentId) {
      return;
    }
    setStatus("saving");
    const handle = window.setTimeout(() => {
      void ensurePersisted()
        .then(() => setStatus("saved"))
        .catch((err: unknown) => {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Save failed");
        });
    }, 700);
    return () => window.clearTimeout(handle);
  }, [commercial, documentId, ensurePersisted, open]);

  function updateCommercial(next: CommercialDocument) {
    const wasClean = !dirtyRef.current;
    dirtyRef.current = true;
    setCommercial(next);
    setStatus("idle");
    // Persist on first edit so refresh can restore; later edits debounce via effect.
    if (wasClean && !documentId && !createLockRef.current) {
      void (async () => {
        try {
          setStatus("saving");
          await ensurePersisted();
          setStatus("saved");
        } catch (err) {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Save failed");
        }
      })();
    }
  }

  function requestClose() {
    if (dirtyRef.current) {
      setConfirmClose(true);
      return;
    }
    onClose();
  }

  async function handleSaveDraft() {
    setBusy(true);
    setError(null);
    try {
      setStatus("saving");
      await ensurePersisted();
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadPdf() {
    setBusy(true);
    setError(null);
    try {
      const saved = await ensurePersisted();
      if (!saved) {
        throw new Error("Save before downloading");
      }
      window.open(`/api/commercial/documents/${saved.id}/pdf`, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await ensurePersisted();
      if (!saved) {
        throw new Error("Save before creating a template");
      }
      const response = await fetch(`/api/commercial/documents/${saved.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save_template", name: templateName.trim() }),
      });
      if (!response.ok) {
        throw new Error("Could not save template");
      }
      setTemplateOpen(false);
      setTemplateName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Template save failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleConvert() {
    setBusy(true);
    setError(null);
    try {
      const saved = await ensurePersisted();
      if (!saved) {
        throw new Error("Save before converting");
      }
      const response = await fetch(`/api/commercial/documents/${saved.id}/actions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "convert_to_invoice" }),
      });
      if (!response.ok) {
        throw new Error("Convert failed");
      }
      const payload = (await response.json()) as { document: CommercialDocumentRecord };
      applyRecord(payload.document);
      window.history.replaceState(null, "", `/app/documents/${payload.document.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Convert failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogoKey(key: string) {
    updateCommercial({ ...commercial, logoAssetKey: key });
    // Persist as the workspace company logo so future Quotes/Invoices pick it up.
    await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoAssetKey: key }),
    }).catch(() => undefined);
  }

  if (!open) {
    return null;
  }

  const statusLabel =
    status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Save failed" : "";

  return (
    <div
      className="fixed inset-0 z-[90] flex items-stretch justify-center bg-slate-900/50 p-0 sm:items-start sm:p-4 sm:pt-10"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full max-w-[1200px] flex-col overflow-hidden bg-white shadow-2xl sm:h-[min(920px,calc(100vh-3rem))] sm:rounded-xl sm:border sm:border-border"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-border bg-white px-3 py-2">
          <input
            id={titleId}
            value={commercial.internalName}
            onChange={(event) => updateCommercial({ ...commercial, internalName: event.target.value })}
            className="min-w-[10rem] flex-1 rounded-md border border-transparent px-2 py-1.5 text-sm font-semibold text-[#0f2744] outline-none hover:border-[#d7dee8] focus:border-[#22c55e]"
            aria-label="Document name"
          />
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            {commercial.type}
          </span>
          <span className="text-xs text-muted">{statusLabel}</span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <ToolbarButton onClick={() => void handleSaveDraft()} disabled={busy}>
              Save Draft
            </ToolbarButton>
            <ToolbarButton onClick={() => setTemplateOpen(true)} disabled={busy}>
              Save as Template
            </ToolbarButton>
            <ToolbarButton onClick={() => void handleDownloadPdf()} disabled={busy}>
              Download PDF
            </ToolbarButton>
            {commercial.type === "quote" ? (
              <ToolbarButton onClick={() => void handleConvert()} disabled={busy}>
                Convert to Invoice
              </ToolbarButton>
            ) : null}
            <ToolbarButton
              onClick={() => {
                if (documentId) {
                  window.location.href = `/app/documents/${documentId}`;
                }
              }}
              disabled={!documentId || busy}
            >
              Send
            </ToolbarButton>
            <button
              ref={closeRef}
              type="button"
              onClick={requestClose}
              className="rounded-md px-2 py-1.5 text-sm text-muted hover:bg-slate-100 hover:text-foreground"
            >
              Close
            </button>
          </div>
        </div>

        {error ? <p className="shrink-0 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

        <div className="min-h-0 flex-1 overflow-auto bg-[#eef1f5] px-3 py-6 sm:px-6">
          <CommercialDocumentCanvas
            commercial={commercial}
            onChange={updateCommercial}
            onLogoKey={(key) => {
              void handleLogoKey(key).catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Logo upload failed");
              });
            }}
          />
        </div>
      </div>

      {confirmClose ? (
        <ConfirmDialog
          title="Discard unsaved changes?"
          body="You have unsaved edits. Close without saving?"
          confirmLabel="Discard"
          onCancel={() => setConfirmClose(false)}
          onConfirm={() => {
            setConfirmClose(false);
            dirtyRef.current = false;
            onClose();
          }}
        />
      ) : null}

      {templateOpen ? (
        <ConfirmDialog
          title="Save as Template"
          body="Reusable layout, labels, logo, items, notes, and terms are kept. Recipient details, dates, PO, payments, and send history are reset."
          confirmLabel="Save template"
          onCancel={() => setTemplateOpen(false)}
          onConfirm={() => void handleSaveTemplate()}
        >
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-muted">Template name</span>
            <input
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              className="h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:border-[#22c55e]"
              placeholder="Acme quote template"
            />
          </label>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-slate-50 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cm-confirm-title"
        className="w-full max-w-md rounded-xl border border-border bg-white p-4 shadow-2xl"
      >
        <h3 id="cm-confirm-title" className="text-sm font-semibold text-foreground">
          {title}
        </h3>
        <p className="mt-2 text-sm text-muted">{body}</p>
        {children}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
