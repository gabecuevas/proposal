"use client";

import { useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CreatorCanvas } from "@/components/editor/creator/creator-canvas";
import { CreatorFieldsSidebar } from "@/components/editor/creator/creator-fields-sidebar";
import { CreatorHeader } from "@/components/editor/creator/creator-header";
import { CreatorPageStrip } from "@/components/editor/creator/creator-page-strip";
import { SignerRecipientProvider } from "@/components/editor/signer-field-context";
import { defaultPricingModel } from "@/lib/editor/defaults";
import { editorExtensions } from "@/lib/editor/extensions";
import { insertPageBreak } from "@/lib/editor/insert-elements";
import { insertSignerFieldAtPoint, insertSignerFieldBlock } from "@/lib/editor/insert-signer-field";
import { migrateSignerFieldsDoc } from "@/lib/editor/migrate-signer-fields";
import { pageSizeFromDoc, pageSizeSpec, withPageSize, type PageSizeId } from "@/lib/editor/page-geometry";
import { calculateQuoteTotals } from "@/lib/editor/quote";
import { renderComputedHtml } from "@/lib/editor/render";
import type { SignerFieldEditorType } from "@/lib/editor/signer-field-attrs";
import { serializeStable } from "@/lib/editor/stable";
import type { EditorDoc, PricingModel, VariableContext, VariableRegistry } from "@/lib/editor/types";
import { resolveTemplateVariables } from "@/lib/editor/variables";
import { documentTitleFromEditorJson } from "@/lib/ui/document-title";
import { pageCountFromEditor } from "@/lib/ui/template-meta";

type Params = {
  params: Promise<{ documentId: string }>;
};

type Recipient = { id: string; email: string; name: string; role: "signer" | "approver" | "viewer" };
type DocumentDetail = {
  id: string;
  template_id: string | null;
  contact_id: string | null;
  status: string;
  editor_json: EditorDoc;
  variables_json: VariableContext;
  pricing_json: PricingModel;
  recipients_json: Recipient[];
  doc_hash: string | null;
  finalized_pdf_key: string | null;
  created_at?: string;
  updated_at: string;
};

type Contact = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
};

const fallbackRecipient: Recipient = {
  id: "recipient-primary",
  email: "",
  name: "Primary Signer",
  role: "signer",
};

function asJsonObject(value: string, fallback: VariableContext): VariableContext {
  try {
    return JSON.parse(value) as VariableContext;
  } catch {
    return fallback;
  }
}

function contactToVariables(contact: Contact): VariableContext {
  const addressFull = [
    contact.address_line_1,
    contact.address_line_2,
    [contact.city, contact.state, contact.postal_code].filter(Boolean).join(" "),
    contact.country,
  ]
    .filter(Boolean)
    .join(", ");

  return {
    contact: {
      id: contact.id,
      first_name: contact.first_name,
      last_name: contact.last_name,
      full_name: contact.full_name,
      email: contact.email,
      company_name: contact.company_name ?? "",
      phone: contact.phone ?? "",
      address: {
        line_1: contact.address_line_1 ?? "",
        line_2: contact.address_line_2 ?? "",
        city: contact.city ?? "",
        state: contact.state ?? "",
        postal_code: contact.postal_code ?? "",
        country: contact.country ?? "",
        full: addressFull,
      },
    },
  };
}

function statusLabel(status: string | undefined): string {
  if (!status || status === "DRAFTED") {
    return "Draft";
  }
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function applyTitleToDoc(doc: EditorDoc, title: string): EditorDoc {
  const next = structuredClone(doc);
  const first = next.content[0];
  if (first && (first.type === "heading" || first.type === "paragraph")) {
    first.content = title ? [{ type: "text", text: title }] : [];
    return next;
  }
  next.content = [
    { type: "heading", attrs: { level: 1 }, content: [{ type: "text", text: title || "Untitled" }] },
    ...next.content,
  ];
  return next;
}

export default function DocumentDetailPage({ params }: Params) {
  const router = useRouter();
  const [documentId, setDocumentId] = useState("");
  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [contactId, setContactId] = useState<string>("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [variableRegistry, setVariableRegistry] = useState<VariableRegistry>({});
  const [variablesText, setVariablesText] = useState("{}");
  const [pricing, setPricing] = useState<PricingModel>(defaultPricingModel);
  const [recipientsText, setRecipientsText] = useState("[]");
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState("");
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [name, setName] = useState("");
  const [historyTick, setHistoryTick] = useState(0);
  const [visualPages, setVisualPages] = useState(1);
  const [pageSize, setPageSize] = useState<PageSizeId>("letter");

  const editor = useEditor({
    immediatelyRender: false,
    extensions: editorExtensions,
    content: document ? migrateSignerFieldsDoc(document.editor_json) : undefined,
    editorProps: {
      attributes: {
        class: "tiptap-creator min-h-full max-w-none focus:outline-none",
      },
    },
    onUpdate() {
      setHistoryTick((n) => n + 1);
    },
    onTransaction() {
      setHistoryTick((n) => n + 1);
    },
  });

  const serializedDoc = editor
    ? serializeStable(withPageSize(editor.getJSON() as EditorDoc, pageSize))
    : document
      ? serializeStable(withPageSize(document.editor_json, pageSize))
      : serializeStable({ type: "doc", content: [] });

  const parsedVariables = asJsonObject(variablesText, document?.variables_json ?? {});
  const variableOutput = resolveTemplateVariables(variableRegistry, parsedVariables);
  const parsedRecipients = useMemo(() => {
    try {
      const parsed = JSON.parse(recipientsText) as Recipient[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : [fallbackRecipient];
    } catch {
      return document?.recipients_json?.length ? document.recipients_json : [fallbackRecipient];
    }
  }, [document?.recipients_json, recipientsText]);
  const quoteTotals = calculateQuoteTotals(pricing);
  const previewHtml = useMemo(
    () =>
      renderComputedHtml({
        doc: JSON.parse(serializedDoc) as EditorDoc,
        mode: "sender-preview",
        resolvedVariables: variableOutput.resolved,
        pricing,
        signerFieldValues: [],
      }),
    [pricing, serializedDoc, variableOutput.resolved],
  );
  const pageCount = Math.max(pageCountFromEditor(JSON.parse(serializedDoc) as EditorDoc), visualPages);
  const derivedTitle = useMemo(() => {
    if (!document) {
      return "Untitled document";
    }
    try {
      return documentTitleFromEditorJson(JSON.parse(serializedDoc) as EditorDoc, document.id);
    } catch {
      return document.id;
    }
  }, [document, serializedDoc]);

  const saveStatusLine = useMemo(() => {
    if (status === "Saving...") {
      return "Saving…";
    }
    if (status === "Saved" || status === "Idle") {
      return "Saved just now";
    }
    return status;
  }, [status]);

  async function loadDocument(targetDocumentId: string) {
    setError("");
    const response = await fetch(`/api/documents/${targetDocumentId}`);
    if (!response.ok) {
      setError("Failed to load document.");
      return;
    }
    const payload = (await response.json()) as { document: DocumentDetail };
    const loadedRecipients =
      payload.document.recipients_json.length > 0
        ? payload.document.recipients_json
        : [fallbackRecipient];
    setDocument(payload.document);
    setContactId(payload.document.contact_id ?? "");
    setVariablesText(JSON.stringify(payload.document.variables_json, null, 2));
    setPricing(payload.document.pricing_json);
    setRecipientsText(JSON.stringify(loadedRecipients, null, 2));
    setName(documentTitleFromEditorJson(payload.document.editor_json, payload.document.id));
    setPageSize(pageSizeFromDoc(payload.document.editor_json));
    const snapshot = JSON.stringify({
      doc: serializeStable(payload.document.editor_json),
      variables: JSON.stringify(payload.document.variables_json),
      pricing: JSON.stringify(payload.document.pricing_json),
      recipients: JSON.stringify(loadedRecipients),
      contactId: payload.document.contact_id ?? "",
    });
    setLastSavedSnapshot(snapshot);
    if (editor) {
      editor.commands.setContent(migrateSignerFieldsDoc(payload.document.editor_json));
    }
    setSelectedRecipientId(loadedRecipients[0]?.id ?? "");

    if (payload.document.template_id) {
      const templateResponse = await fetch(`/api/templates/${payload.document.template_id}`);
      if (templateResponse.ok) {
        const templatePayload = (await templateResponse.json()) as {
          template: { variable_registry: VariableRegistry };
        };
        setVariableRegistry(templatePayload.template.variable_registry);
      } else {
        setVariableRegistry({});
      }
    } else {
      setVariableRegistry({});
    }
  }

  async function loadContacts() {
    const response = await fetch("/api/contacts?limit=200");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { contacts: Contact[] };
    setContacts(payload.contacts);
  }

  const saveNow = useCallback(async () => {
    if (!documentId) {
      return;
    }
    setError("");
    setStatus("Saving...");

    const payload = {
      editor_json: JSON.parse(serializedDoc) as EditorDoc,
      variables_json: parsedVariables,
      pricing_json: pricing,
      recipients_json: parsedRecipients,
      contact_id: contactId || null,
    };
    const response = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        error?: string | { message?: string };
      } | null;
      const msg =
        typeof body?.error === "string" ? body.error : (body?.error?.message ?? "Save failed");
      setError(msg);
      setStatus("Save failed");
      return;
    }
    const snapshot = JSON.stringify({
      doc: serializedDoc,
      variables: JSON.stringify(parsedVariables),
      pricing: JSON.stringify(pricing),
      recipients: JSON.stringify(parsedRecipients),
      contactId,
    });
    setLastSavedSnapshot(snapshot);
    setStatus("Saved");
  }, [contactId, documentId, parsedRecipients, parsedVariables, pricing, serializedDoc]);

  async function sendDocument() {
    if (!documentId) return;
    const response = await fetch(`/api/documents/${documentId}/send`, { method: "POST" });
    if (!response.ok) {
      setError("Failed to send document.");
      return;
    }
    setStatus("Document sent.");
    await loadDocument(documentId);
  }

  async function finalizeDocument() {
    if (!documentId) return;
    const response = await fetch(`/api/documents/${documentId}/finalize`, { method: "POST" });
    if (!response.ok) {
      setError("Failed to finalize document.");
      return;
    }
    setStatus("Document finalized.");
    await loadDocument(documentId);
  }

  async function exportArtifact() {
    if (!documentId) return;
    const response = await fetch(`/api/documents/${documentId}/artifact-url`, { method: "POST" });
    if (!response.ok) {
      setError("Finalized PDF is not available yet.");
      return;
    }
    const payload = (await response.json()) as { downloadUrl: string };
    window.open(payload.downloadUrl, "_blank", "noopener,noreferrer");
  }

  async function openSigningSession() {
    if (!documentId || parsedRecipients.length === 0) return;
    const recipient = parsedRecipients[0];
    if (!recipient) return;
    const response = await fetch(`/api/documents/${documentId}/signing-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: recipient.id }),
    });
    if (!response.ok) {
      setError("Failed to create signing session.");
      return;
    }
    const payload = (await response.json()) as { signingUrl: string };
    window.open(payload.signingUrl, "_blank", "noopener,noreferrer");
  }

  function renameDocument(nextName: string) {
    setName(nextName);
    if (!editor) {
      return;
    }
    editor.commands.setContent(applyTitleToDoc(editor.getJSON() as EditorDoc, nextName));
  }

  function insertSignerField(type: SignerFieldEditorType) {
    if (!editor) {
      return;
    }
    const recipientId = selectedRecipientId || parsedRecipients[0]?.id;
    if (!recipientId) {
      return;
    }
    insertSignerFieldBlock(editor, { recipientId, type });
  }

  async function duplicateThis() {
    if (!documentId) {
      return;
    }
    await saveNow();
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceDocumentId: documentId }),
    });
    if (!response.ok) {
      setError("Could not duplicate this document.");
      return;
    }
    const payload = (await response.json()) as { document: { id: string } };
    router.push(`/app/documents/${payload.document.id}`);
  }

  async function saveAsTemplate() {
    if (!editor) {
      return;
    }
    await saveNow();
    const response = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name || derivedTitle,
        editor_json: editor.getJSON() as EditorDoc,
        tags: ["from-document"],
      }),
    });
    if (!response.ok) {
      setError("Could not save this document as a template.");
      return;
    }
    const payload = (await response.json()) as { template: { id: string } };
    router.push(`/app/templates/${payload.template.id}`);
  }

  useEffect(() => {
    async function load() {
      const resolved = await params;
      setDocumentId(resolved.documentId);
      await Promise.all([loadDocument(resolved.documentId), loadContacts()]);
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    if (!editor || !document) {
      return;
    }
    editor.commands.setContent(migrateSignerFieldsDoc(document.editor_json));
  }, [document, editor]);

  useEffect(() => {
    if (!selectedRecipientId && parsedRecipients.length > 0) {
      const first = parsedRecipients[0];
      if (first) {
        setSelectedRecipientId(first.id);
      }
    }
  }, [parsedRecipients, selectedRecipientId]);

  useEffect(() => {
    if (!documentId || !document) {
      return;
    }
    const id = window.setInterval(() => {
      const currentSnapshot = JSON.stringify({
        doc: serializedDoc,
        variables: JSON.stringify(parsedVariables),
        pricing: JSON.stringify(pricing),
        recipients: JSON.stringify(parsedRecipients),
        contactId,
      });
      if (currentSnapshot === lastSavedSnapshot) {
        return;
      }
      void saveNow();
    }, 1400);
    return () => window.clearInterval(id);
  }, [
    contactId,
    document,
    documentId,
    lastSavedSnapshot,
    parsedRecipients,
    parsedVariables,
    pricing,
    saveNow,
    serializedDoc,
  ]);

  const canUndo = Boolean(editor?.can().undo()) && historyTick >= 0;
  const canRedo = Boolean(editor?.can().redo()) && historyTick >= 0;
  const unassignedRoleCount = parsedRecipients.filter((r) => !r.email.trim()).length;

  if (!document) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-sm text-muted">{error || "Loading document…"}</p>
      </div>
    );
  }

  return (
    <SignerRecipientProvider
      recipients={parsedRecipients.map((r) => ({ id: r.id, name: r.name || r.email || "Signer" }))}
    >
      <div className="flex h-screen w-full flex-col bg-background">
        <CreatorHeader
          name={name || derivedTitle}
          onNameChange={renameDocument}
          saveStatus={saveStatusLine}
          statusLabel={statusLabel(document.status)}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={() => editor?.chain().focus().undo().run()}
          onRedo={() => editor?.chain().focus().redo().run()}
          closeHref="/app/documents"
          editor={editor}
          pageSize={pageSize}
          onPageSizeChange={(size: PageSizeId) => {
            setPageSize(size);
            editor?.commands.setPageSize(size);
          }}
          fileItems={[
            { label: "Duplicate", onClick: () => void duplicateThis() },
            { label: "Save as template", onClick: () => void saveAsTemplate() },
            { label: "Export PDF", onClick: () => void exportArtifact() },
          ]}
          primaryActionLabel="Review and send"
          onPrimaryAction={() => void sendDocument()}
          moreItems={[
            { label: "Save now", onClick: () => void saveNow() },
            { label: "Preview", onClick: () => setShowPreview(true) },
            { label: "Export PDF", onClick: () => void exportArtifact() },
            { label: "Finalize", onClick: () => void finalizeDocument() },
            { label: "Signing session", onClick: () => void openSigningSession() },
          ]}
        />

        {error ? <p className="border-b border-border bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p> : null}

        <div className="flex min-h-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            <CreatorPageStrip
              name={name || derivedTitle}
              pageCount={pageCount}
              currentPage={1}
              pageSizeLabel={pageSizeSpec(pageSize).shortLabel}
              onAddPage={() => editor && insertPageBreak(editor)}
            />
            <CreatorCanvas
              editor={editor}
              pageSize={pageSize}
              documentId={documentId || undefined}
              onPageCountChange={setVisualPages}
              onDropField={(type, clientX, clientY) => {
                const recipientId = selectedRecipientId || parsedRecipients[0]?.id;
                if (!editor || !recipientId) {
                  return;
                }
                insertSignerFieldAtPoint(editor, {
                  recipientId,
                  type: type as SignerFieldEditorType,
                  clientX,
                  clientY,
                });
              }}
            />
          </div>

          <CreatorFieldsSidebar
            editor={editor}
            recipients={parsedRecipients.map((r) => ({
              id: r.id,
              name: r.name || "Signer",
              email: r.email || undefined,
            }))}
            selectedRecipientId={selectedRecipientId}
            onSelectRecipient={setSelectedRecipientId}
            onInsertField={insertSignerField}
            missingVariableCount={variableOutput.missing.length}
            unassignedRoleCount={unassignedRoleCount}
            onManageRecipients={() => setShowAdvanced(true)}
            onManageVariables={() => setShowAdvanced(true)}
            onReviewData={() => setShowPreview(true)}
          />
        </div>

        <details
          className="shrink-0 border-t border-border bg-surface"
          open={showAdvanced}
          onToggle={(event) => setShowAdvanced((event.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer px-4 py-2 text-xs font-medium text-muted hover:text-foreground">
            Advanced workspace tools
          </summary>
          <div className="grid max-h-72 gap-3 overflow-auto p-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-2 text-xs uppercase text-muted">Recipients</p>
              <textarea
                id="recipients-json"
                className="h-28 w-full rounded border border-border bg-surface p-2 font-mono text-[11px]"
                value={recipientsText}
                onChange={(event) => setRecipientsText(event.target.value)}
              />
              <p className="mt-2 text-xs text-muted">Contact</p>
              <select
                className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-sm"
                value={contactId}
                onChange={(event) => {
                  const nextContactId = event.target.value;
                  setContactId(nextContactId);
                  const selected = contacts.find((contact) => contact.id === nextContactId);
                  if (selected) {
                    const current = asJsonObject(variablesText, {});
                    setVariablesText(JSON.stringify({ ...current, ...contactToVariables(selected) }, null, 2));
                  }
                }}
              >
                <option value="">No contact</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.full_name} ({contact.email})
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-2 text-xs uppercase text-muted">Variables</p>
              <textarea
                className="h-36 w-full rounded border border-border bg-surface p-2 font-mono text-[11px]"
                value={variablesText}
                onChange={(event) => setVariablesText(event.target.value)}
              />
              <p className="mt-1 text-[11px] text-muted">
                Missing: {variableOutput.missing.length ? variableOutput.missing.join(", ") : "none"}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-2 text-xs uppercase text-muted">Pricing</p>
              <label className="mb-2 block text-xs text-muted">
                Currency
                <input
                  className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-xs"
                  value={pricing.currency}
                  onChange={(event) => setPricing((c) => ({ ...c, currency: event.target.value }))}
                />
              </label>
              <label className="mb-2 block text-xs text-muted">
                Discount %
                <input
                  className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-xs"
                  type="number"
                  value={pricing.discountPercent ?? 0}
                  onChange={(event) => setPricing((c) => ({ ...c, discountPercent: Number(event.target.value) }))}
                />
              </label>
              <label className="mb-2 block text-xs text-muted">
                Tax %
                <input
                  className="mt-1 w-full rounded border border-border bg-surface px-2 py-1 text-xs"
                  type="number"
                  value={pricing.taxPercent ?? 0}
                  onChange={(event) => setPricing((c) => ({ ...c, taxPercent: Number(event.target.value) }))}
                />
              </label>
              <p className="text-xs text-muted">Total due now: {quoteTotals.totalDueNow.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-2 text-xs uppercase text-muted">Document details</p>
              <p className="text-sm">
                Status: <span className="font-medium">{statusLabel(document.status)}</span>
              </p>
              <p className="mt-1 text-sm text-muted">
                Created{" "}
                {document.created_at || document.updated_at
                  ? new Date(document.created_at ?? document.updated_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "—"}
              </p>
              <p className="mt-3 text-xs uppercase text-muted">Activity</p>
              <p className="mt-1 text-sm">Document loaded</p>
              <p className="text-xs text-muted">Workspace</p>
            </div>
          </div>
        </details>
      </div>

      {showPreview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Preview"
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Preview</p>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="rounded-md p-2 text-muted hover:bg-slate-100"
                aria-label="Close preview"
              >
                ×
              </button>
            </div>
            <div
              className="prose prose-sm prose-neutral max-h-[calc(90vh-4rem)] overflow-auto p-4 font-app-serif"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </div>
      ) : null}
    </SignerRecipientProvider>
  );
}
