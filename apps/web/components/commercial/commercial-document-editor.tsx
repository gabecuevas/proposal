"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@repo/ui/utils";
import { CommercialDocumentCanvas, type CommercialTextFieldId } from "./commercial-document-canvas";
import { CommercialPagePropertiesPanel } from "./commercial-page-properties";
import { CommercialVariablesPanel } from "./commercial-variables-panel";
import { useNewDocumentWorkflow } from "@/components/documents/new-document-workflow-context";
import { UseTemplateWizardChrome } from "@/components/documents/use-template-wizard-chrome";
import {
  FlowActionsMenu,
  type FlowActionsMenuItem,
} from "@/components/flow-document/flow-actions-menu";
import { FlowToolShelf } from "@/components/flow-document/flow-tool-shelf";
import "@/components/flow-document/flow-document-prototype.css";
import {
  createBlankCommercialDocument,
  DEFAULT_COMMERCIAL_THEME,
  type CommercialDocType,
  type CommercialDocument,
} from "@/lib/commercial/schema";
import { ensureCommercialDocument } from "@/lib/commercial/parse";
import type { CommercialDocumentRecord } from "@/lib/commercial/store";
import {
  countCommercialTokenUsageMap,
  countCommercialTokenUsages,
  insertCommercialTokenAt,
} from "@/lib/commercial/variables";
import { flowGoogleFontsStylesheetHref } from "@/lib/flow-document/google-fonts";
import { AUTOSAVE_DELAY_MS } from "@/lib/editor/autosave";
import { SaveQueue } from "@/lib/editor/save-queue";

/** Accent bar green sampled from the Quote brand icon. */
const QUOTE_ACCENT = "#146440";
const DOCUMENTS_HREF = "/app/documents";
const TEMPLATES_HREF = "/app/templates";

type Props = {
  /** Existing draft document id (document route). */
  documentId?: string;
  /** Library template id (template route). */
  templateId?: string;
  type: CommercialDocType;
  closeHref?: string;
  masterPreview?: boolean;
  initialName?: string;
  initialCommercial?: CommercialDocument;
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Full-screen Quote/Invoice editor (immersive document route), matching
 * Flow/Creator page chrome rather than a modal overlay.
 * Also opens commercial templates from the Library.
 */
export function CommercialDocumentEditor({
  documentId,
  templateId,
  type,
  closeHref,
  masterPreview = false,
  initialName,
  initialCommercial,
}: Props) {
  const router = useRouter();
  const { openWorkflow } = useNewDocumentWorkflow();
  const titleId = useId();
  const isTemplate = Boolean(templateId);
  const locked = masterPreview;
  const backHref = closeHref ?? (isTemplate ? TEMPLATES_HREF : DOCUMENTS_HREF);
  const dirtyRef = useRef(false);
  const saveQueueRef = useRef(new SaveQueue());
  const [commercial, setCommercial] = useState<CommercialDocument>(() => {
    const base = initialCommercial
      ? { ...initialCommercial }
      : createBlankCommercialDocument(type);
    if (initialName) {
      base.internalName = initialName;
    }
    return base;
  });
  const commercialRef = useRef<CommercialDocument>(commercial);
  const versionRef = useRef(1);
  const activeDocumentIdRef = useRef(documentId ?? "");
  const templateIdRef = useRef(templateId ?? "");
  const [activeDocumentId, setActiveDocumentId] = useState(documentId ?? "");
  const [status, setStatus] = useState<SaveStatus>(initialCommercial ? "saved" : "idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!initialCommercial);
  const [confirmClose, setConfirmClose] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [activeShelfPanel, setActiveShelfPanel] = useState<"variables" | "page" | null>(null);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [saveRetryToken, setSaveRetryToken] = useState(0);
  const [fieldCaret, setFieldCaret] = useState<{
    field: CommercialTextFieldId;
    start: number;
    end: number;
  }>({ field: "sender", start: 0, end: 0 });

  const applyRecord = useCallback(
    (document: CommercialDocumentRecord, options?: { resetCaret?: boolean }) => {
      commercialRef.current = document.commercial;
      versionRef.current = document.doc_version;
      activeDocumentIdRef.current = document.id;
      setCommercial(document.commercial);
      setActiveDocumentId(document.id);
      dirtyRef.current = false;
      setStatus("saved");
      if (options?.resetCaret) {
        setFieldCaret({
          field: "sender",
          start: document.commercial.sender.text.length,
          end: document.commercial.sender.text.length,
        });
      }
    },
    [],
  );

  useEffect(() => {
    if (documentId) {
      setActiveDocumentId(documentId);
      activeDocumentIdRef.current = documentId;
    }
  }, [documentId]);

  useEffect(() => {
    templateIdRef.current = templateId ?? "";
  }, [templateId]);

  useEffect(() => {
    const href = flowGoogleFontsStylesheetHref();
    if (window.document.querySelector(`link[href="${href}"]`)) {
      return;
    }
    const link = window.document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.dataset.commercialGoogleFonts = "1";
    window.document.head.appendChild(link);
  }, []);

  useEffect(() => {
    let cancelled = false;
    dirtyRef.current = false;
    setError(null);
    setConfirmClose(false);

    async function bootDocument(id: string) {
      setStatus("idle");
      setLoading(true);
      const response = await fetch(`/api/commercial/documents/${id}`);
      if (!response.ok) {
        if (!cancelled) {
          setError("Could not load document");
          setLoading(false);
        }
        return;
      }
      const payload = (await response.json()) as { document: CommercialDocumentRecord };
      if (!cancelled) {
        applyRecord(payload.document, { resetCaret: true });
        setLoading(false);
      }
    }

    async function bootTemplate(id: string) {
      if (initialCommercial) {
        const next = {
          ...initialCommercial,
          internalName: initialName || initialCommercial.internalName,
        };
        commercialRef.current = next;
        setCommercial(next);
        setStatus("saved");
        setLoading(false);
        return;
      }
      setStatus("idle");
      setLoading(true);
      const response = await fetch(`/api/templates/${id}`);
      if (!response.ok) {
        if (!cancelled) {
          setError("Could not load template");
          setLoading(false);
        }
        return;
      }
      const payload = (await response.json()) as {
        template: { name: string; pricing_json: unknown };
      };
      if (!cancelled) {
        const next = ensureCommercialDocument(payload.template.pricing_json, type);
        next.internalName = payload.template.name || next.internalName;
        commercialRef.current = next;
        setCommercial(next);
        setStatus("saved");
        setLoading(false);
        setFieldCaret({
          field: "sender",
          start: next.sender.text.length,
          end: next.sender.text.length,
        });
      }
    }

    if (templateId) {
      void bootTemplate(templateId);
    } else if (documentId) {
      void bootDocument(documentId);
    } else if (!cancelled) {
      setError("Missing document or template");
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [applyRecord, documentId, initialCommercial, initialName, templateId, type]);

  const persistCommercial = useCallback(async (): Promise<{ id: string }> => {
    const snapshot = commercialRef.current;

    if (templateIdRef.current) {
      const response = await fetch(`/api/templates/${templateIdRef.current}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: snapshot.internalName.trim() || "Untitled Quote",
          pricing_json: snapshot,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string | { message?: string };
          message?: string;
        };
        const message =
          typeof payload.error === "string"
            ? payload.error
            : payload.error?.message || payload.message || "Save failed";
        throw new Error(message);
      }
      if (commercialRef.current !== snapshot) {
        dirtyRef.current = true;
        setSaveRetryToken((token) => token + 1);
        return { id: templateIdRef.current };
      }
      dirtyRef.current = false;
      setStatus("saved");
      return { id: templateIdRef.current };
    }

    const expectedVersion = versionRef.current;
    const response = await fetch(`/api/commercial/documents/${activeDocumentIdRef.current}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ expectedVersion, commercial: snapshot }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
        message?: string;
      };
      throw new Error(payload.error?.message || payload.message || "Save failed");
    }
    const payload = (await response.json()) as { document: CommercialDocumentRecord };
    const document = payload.document;

    // Always advance the optimistic-lock version so the next save can succeed.
    versionRef.current = document.doc_version;
    activeDocumentIdRef.current = document.id;
    setActiveDocumentId(document.id);

    // If the user typed while this request was in flight, keep their local
    // edits and schedule another autosave — never clobber the Item field.
    if (commercialRef.current !== snapshot) {
      dirtyRef.current = true;
      setSaveRetryToken((token) => token + 1);
      return document;
    }

    commercialRef.current = document.commercial;
    setCommercial(document.commercial);
    dirtyRef.current = false;
    setStatus("saved");
    return document;
  }, []);

  const ensurePersisted = useCallback(async (): Promise<{ id: string } | null> => {
    let last: { id: string } | null = null;
    await saveQueueRef.current.run(async () => {
      // Flush until the payload we just saved matches what's on screen.
      for (let attempt = 0; attempt < 8; attempt++) {
        const snapshot = commercialRef.current;
        last = await persistCommercial();
        if (commercialRef.current === snapshot) {
          return;
        }
      }
    });
    return last;
  }, [persistCommercial]);

  useEffect(() => {
    if (!dirtyRef.current || loading || locked) {
      return;
    }
    setStatus("saving");
    const handle = window.setTimeout(() => {
      void saveQueueRef.current
        .run(async () => {
          if (!dirtyRef.current) {
            return;
          }
          await persistCommercial();
        })
        .then(() => {
          if (!dirtyRef.current) {
            setStatus("saved");
          }
        })
        .catch((err: unknown) => {
          setStatus("error");
          setError(err instanceof Error ? err.message : "Save failed");
        });
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(handle);
  }, [commercial, loading, locked, persistCommercial, saveRetryToken]);

  function updateCommercial(next: CommercialDocument) {
    if (locked) {
      return;
    }
    dirtyRef.current = true;
    commercialRef.current = next;
    setCommercial(next);
    setStatus("idle");
  }

  function getFieldText(doc: CommercialDocument, field: CommercialTextFieldId): string {
    switch (field) {
      case "sender":
        return doc.sender.text;
      case "billTo":
        return doc.billTo.text;
      case "shipTo":
        return doc.shipTo.text;
      case "notes":
        return doc.notes;
      case "terms":
        return doc.terms;
    }
  }

  function withFieldText(
    doc: CommercialDocument,
    field: CommercialTextFieldId,
    text: string,
  ): CommercialDocument {
    switch (field) {
      case "sender":
        return { ...doc, sender: { ...doc.sender, text } };
      case "billTo":
        return { ...doc, billTo: { ...doc.billTo, text } };
      case "shipTo":
        return { ...doc, shipTo: { ...doc.shipTo, text } };
      case "notes":
        return { ...doc, notes: text };
      case "terms":
        return { ...doc, terms: text };
    }
  }

  function insertVariable(key: string) {
    const field = fieldCaret.field;
    const current = getFieldText(commercial, field);
    const inserted = insertCommercialTokenAt(current, key, fieldCaret.start, fieldCaret.end);
    updateCommercial(withFieldText(commercial, field, inserted.text));
    setFieldCaret({ field, start: inserted.caret, end: inserted.caret });
    setActiveShelfPanel("variables");
  }

  const variableUsageMap = useMemo(
    () =>
      countCommercialTokenUsageMap([
        commercial.sender.text,
        commercial.billTo.text,
        commercial.shipTo.text,
        commercial.notes,
        commercial.terms,
      ]),
    [commercial],
  );
  const variableCount = useMemo(
    () =>
      countCommercialTokenUsages([
        commercial.sender.text,
        commercial.billTo.text,
        commercial.shipTo.text,
        commercial.notes,
        commercial.terms,
      ]),
    [commercial],
  );

  function requestClose() {
    if (dirtyRef.current) {
      setConfirmClose(true);
      return;
    }
    router.push(backHref);
  }

  async function handleSaveDraft() {
    if (locked) {
      return;
    }
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

  async function copySampleToLibrary() {
    const id = templateIdRef.current.trim();
    if (!masterPreview || !id || busy) {
      return;
    }
    setBusy(true);
    setError(null);
    setStatus("saving");
    try {
      const response = await fetch(`/api/templates/samples/${id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error("Could not copy to My Library");
      }
      router.push("/app/templates?tab=mine");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Copy failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadPdf() {
    if (isTemplate) {
      setError("Create a document from this template to download a PDF.");
      return;
    }
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

  async function handleUseTemplate() {
    if (!templateId) {
      return;
    }
    try {
      await ensurePersisted();
    } catch {
      // still allow use with last saved state
    }
    openWorkflow({
      templateId,
      templateName: commercial.internalName.trim() || (commercial.type === "invoice" ? "Untitled Invoice" : "Untitled Quote"),
      kind: commercial.type === "invoice" ? "invoice" : "quote",
    });
  }

  async function handleSaveTemplate() {
    if (!templateName.trim() || isTemplate || busy) {
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
    if (isTemplate) {
      return;
    }
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
      router.replace(`/app/documents/${payload.document.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Convert failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogoKey(key: string) {
    updateCommercial({ ...commercial, logoAssetKey: key });
    await fetch("/api/workspace", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ logoAssetKey: key }),
    }).catch(() => undefined);
  }

  const statusLabel =
    status === "saving" ? "Saving…" : status === "saved" ? "Saved" : status === "error" ? "Save failed" : "";

  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!fileMenuOpen) {
      return;
    }
    function onPointer(event: MouseEvent) {
      if (fileMenuRef.current && !fileMenuRef.current.contains(event.target as Node)) {
        setFileMenuOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setFileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [fileMenuOpen]);

  const actionsItems = useMemo<FlowActionsMenuItem[]>(() => {
    if (masterPreview) {
      return [
        {
          id: "copy-sample",
          label: "Copy to My Library",
          description: "Add this master template to your workspace library.",
          onSelect: () => {
            void copySampleToLibrary();
          },
          disabled: busy || loading,
        },
      ];
    }
    if (isTemplate) {
      const items: FlowActionsMenuItem[] = [
        {
          id: "save-template",
          label: "Save template",
          description: "Save changes to this library template.",
          onSelect: () => {
            void handleSaveDraft();
          },
          disabled: busy || loading || locked,
        },
        {
          id: "use-template",
          label: "Use template",
          description: "Create a new quote or invoice from this template.",
          onSelect: () => {
            void handleUseTemplate();
          },
          disabled: busy || loading,
        },
      ];
      return items;
    }
    const items: FlowActionsMenuItem[] = [
      {
        id: "save-draft",
        label: "Save draft",
        description: "Save the latest changes without sending.",
        onSelect: () => {
          void handleSaveDraft();
        },
        disabled: busy || loading,
      },
      {
        id: "save-template",
        label: "Save as template",
        description: "Reuse this layout for future quotes and invoices.",
        onSelect: () => setTemplateOpen(true),
        disabled: busy || loading,
      },
      {
        id: "download-pdf",
        label: "Download PDF",
        description: "Export a printable PDF of this document.",
        onSelect: () => {
          void handleDownloadPdf();
        },
        disabled: busy || loading,
      },
    ];
    if (commercial.type === "quote") {
      items.push({
        id: "convert-invoice",
        label: "Convert to invoice",
        description: "Create a linked invoice from this quote.",
        onSelect: () => {
          void handleConvert();
        },
        disabled: busy || loading,
      });
    }
    items.push({
      id: "send",
      label: "Send",
      description: "Prepare this document to send to recipients.",
      onSelect: () => {
        router.push(`/app/documents/${activeDocumentId}`);
      },
      disabled: busy || loading,
    });
    return items;
    // Handlers close over current state; listing them would churn the menu every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [activeDocumentId, busy, commercial.type, isTemplate, loading, locked, masterPreview, router]);

  function runFileAction(action: () => void) {
    setFileMenuOpen(false);
    action();
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-white">
      <div className="sticky top-0 z-10 shrink-0 border-b border-[#dadce0] bg-white">
        <div className="h-[7px] w-full" style={{ backgroundColor: QUOTE_ACCENT }} aria-hidden />
        <div className="flex items-center gap-2 px-3 pt-2 pb-2">
          <Link
            href={backHref}
            onClick={(event) => {
              if (dirtyRef.current) {
                event.preventDefault();
                requestClose();
              }
            }}
            className="flex h-10 w-10 shrink-0 items-center justify-center self-start rounded-full hover:bg-[#f1f3f4]"
            title={isTemplate ? "Back to Library" : "Back to Documents"}
            aria-label={isTemplate ? "Back to Library" : "Back to Documents"}
          >
            <QuoteDocIcon type={commercial.type} />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <input
                id={titleId}
                value={commercial.internalName}
                onChange={(event) => updateCommercial({ ...commercial, internalName: event.target.value })}
                disabled={loading || locked}
                className="min-w-[10rem] max-w-md truncate border-0 bg-transparent px-1 text-[18px] leading-7 text-[#202124] outline-none hover:border-b hover:border-[#dadce0] focus:border-b focus:border-[#0f2744]"
                placeholder={commercial.type === "invoice" ? "Untitled invoice" : "Untitled quote"}
                aria-label={isTemplate ? "Template name" : "Document name"}
              />
              <span className="hidden text-xs text-[#5f6368] sm:inline">
                {masterPreview ? "Master Template" : isTemplate ? "Template" : "Draft"}
              </span>
              <span className="text-xs text-[#5f6368]">
                {masterPreview
                  ? busy
                    ? "Copying…"
                    : "Preview"
                  : statusLabel}
              </span>
            </div>
            <div ref={fileMenuRef} className="relative mt-0.5 flex flex-wrap items-center gap-0.5 text-[14px] text-[#202124]">
              <button
                type="button"
                disabled={loading}
                className={cn(
                  "rounded px-2 py-0.5 hover:bg-[#f1f3f4] disabled:opacity-40",
                  fileMenuOpen && "bg-[#e6f4ec] text-[#146440]",
                )}
                aria-haspopup="menu"
                aria-expanded={fileMenuOpen}
                onClick={() => setFileMenuOpen((open) => !open)}
              >
                File
              </button>
              {fileMenuOpen ? (
                <div
                  role="menu"
                  aria-label="File"
                  className="absolute left-0 top-full z-50 mt-1 min-w-[14rem] rounded-md border border-[#dadce0] bg-white py-1 shadow-lg"
                >
                  {masterPreview ? (
                    <FileMenuItem
                      label="Copy to My Library"
                      disabled={busy || loading}
                      onClick={() => runFileAction(() => void copySampleToLibrary())}
                    />
                  ) : isTemplate ? (
                    <>
                      <FileMenuItem
                        label="Save"
                        disabled={busy || loading || locked}
                        onClick={() => runFileAction(() => void handleSaveDraft())}
                      />
                      <FileMenuItem
                        label="Use template"
                        disabled={busy || loading}
                        onClick={() => runFileAction(() => void handleUseTemplate())}
                      />
                    </>
                  ) : (
                    <>
                      <FileMenuItem
                        label="Save"
                        disabled={busy || loading}
                        onClick={() => runFileAction(() => void handleSaveDraft())}
                      />
                      <FileMenuItem
                        label="Save as template…"
                        disabled={busy || loading}
                        onClick={() => runFileAction(() => setTemplateOpen(true))}
                      />
                      <FileMenuItem
                        label="Download PDF"
                        disabled={busy || loading}
                        onClick={() => runFileAction(() => void handleDownloadPdf())}
                      />
                      {commercial.type === "quote" ? (
                        <FileMenuItem
                          label="Convert to invoice"
                          disabled={busy || loading}
                          onClick={() => runFileAction(() => void handleConvert())}
                        />
                      ) : null}
                    </>
                  )}
                  <div className="my-1 border-t border-[#eee]" />
                  <FileMenuItem label="Close" onClick={() => runFileAction(requestClose)} />
                </div>
              ) : null}
            </div>
          </div>
          <div className="mr-1 flex shrink-0 items-start gap-2 self-start pt-1">
            <button
              type="button"
              onClick={requestClose}
              className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-[#202124] hover:bg-[#f1f3f4]"
            >
              <span aria-hidden>←</span>
              Back
            </button>
            <FlowActionsMenu items={actionsItems} disabled={busy || loading} />
          </div>
        </div>
        {activeDocumentId ? <UseTemplateWizardChrome documentId={activeDocumentId} /> : null}
      </div>

      {error ? <p className="shrink-0 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p> : null}

      <div className="flow-workspace-main min-h-0 flex-1 overflow-hidden">
        <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-[#eef1f5] px-3 py-6 sm:px-6">
          {loading ? (
            <p className="text-center text-sm text-muted">Loading…</p>
          ) : (
            <CommercialDocumentCanvas
              commercial={commercial}
              onChange={updateCommercial}
              readOnly={locked}
              onFieldFocus={(field, start, end) => setFieldCaret({ field, start, end })}
              onLogoKey={(key) => {
                void handleLogoKey(key).catch((err: unknown) => {
                  setError(err instanceof Error ? err.message : "Logo upload failed");
                });
              }}
            />
          )}
        </div>
        {activeShelfPanel === "variables" ? (
          <CommercialVariablesPanel
            usageCounts={variableUsageMap}
            values={variableValues}
            locked={busy || loading || locked}
            onClose={() => setActiveShelfPanel(null)}
            onInsert={insertVariable}
            onChangeValue={(key, value) =>
              setVariableValues((prev) => ({ ...prev, [key]: value }))
            }
          />
        ) : null}
        {activeShelfPanel === "page" ? (
          <CommercialPagePropertiesPanel
            theme={commercial.theme ?? DEFAULT_COMMERCIAL_THEME}
            labels={{
              item: commercial.labels.item,
              quantity: commercial.labels.quantity,
              rate: commercial.labels.rate,
              amount: commercial.labels.amount,
            }}
            titleLabel={commercial.labels.title || (commercial.type === "invoice" ? "Invoice" : "Quote")}
            locked={busy || loading || locked}
            onClose={() => setActiveShelfPanel(null)}
            onThemeChange={(theme) => updateCommercial({ ...commercial, theme })}
            onLabelsChange={(columnLabels) =>
              updateCommercial({
                ...commercial,
                labels: { ...commercial.labels, ...columnLabels },
              })
            }
          />
        ) : null}
        <FlowToolShelf
          activePanel={activeShelfPanel}
          variableCount={variableCount}
          propertiesPage={1}
          onSelect={(panel) => setActiveShelfPanel(panel)}
          onCollapse={() => setActiveShelfPanel(null)}
        />
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
            router.push(backHref);
          }}
        />
      ) : null}

      {templateOpen ? (
        <ConfirmDialog
          title="Save as Template"
          body="Reusable layout, labels, logo, items, notes, and terms are kept. Recipient details, dates, PO, payments, and send history are reset."
          confirmLabel="Save template"
          busy={busy}
          onCancel={() => {
            if (!busy) {
              setTemplateOpen(false);
            }
          }}
          onConfirm={() => void handleSaveTemplate()}
        >
          <label className="mt-3 block text-sm">
            <span className="mb-1 block text-muted">Template name</span>
            <input
              value={templateName}
              disabled={busy}
              onChange={(event) => setTemplateName(event.target.value)}
              className="h-10 w-full rounded-md border border-border px-3 text-sm outline-none focus:border-[#0f2744] focus:ring-1 focus:ring-[#0f2744] disabled:opacity-60"
              placeholder="Acme quote template"
            />
          </label>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}

function QuoteDocIcon({ type }: { type: CommercialDocType }) {
  if (type === "invoice") {
    return (
      <svg width="40" height="40" viewBox="0 0 72 72" aria-hidden className="h-10 w-10">
        <rect x="16" y="8" width="40" height="52" rx="4" fill="none" stroke={QUOTE_ACCENT} strokeWidth="3.5" />
        <path d="M48 8v12h12" fill="none" stroke={QUOTE_ACCENT} strokeWidth="3.5" strokeLinejoin="round" />
        <text
          x="36"
          y="34"
          textAnchor="middle"
          fill={QUOTE_ACCENT}
          fontSize="18"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
        >
          $
        </text>
        <rect x="14" y="42" width="44" height="16" rx="8" fill={QUOTE_ACCENT} />
        <text
          x="36"
          y="53.5"
          textAnchor="middle"
          fill="#fff"
          fontSize="9"
          fontWeight="700"
          fontFamily="system-ui, sans-serif"
          letterSpacing="0.06em"
        >
          INVOICE
        </text>
      </svg>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- static brand asset; match Flow DocsIcon
    <img
      src="/brand/quote-doc-icon.png"
      alt=""
      width={40}
      height={40}
      className="h-10 w-10 object-contain"
      draggable={false}
    />
  );
}

function FileMenuItem({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center px-3 py-1.5 text-left text-sm text-[#202124] hover:bg-[#f1f3f4] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {label}
    </button>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
  children,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  busy?: boolean;
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
        aria-busy={busy}
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
            disabled={busy}
            className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70",
            )}
          >
            {busy ? "Saving…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
