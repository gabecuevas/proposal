"use client";

import Link from "next/link";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultPricingModel } from "@/lib/editor/defaults";
import { editorExtensions } from "@/lib/editor/extensions";
import { calculateQuoteTotals } from "@/lib/editor/quote";
import { renderComputedHtml } from "@/lib/editor/render";
import { serializeStable } from "@/lib/editor/stable";
import type { EditorDoc, PricingModel, VariableContext, VariableRegistry } from "@/lib/editor/types";
import { resolveTemplateVariables } from "@/lib/editor/variables";

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

export default function DocumentDetailPage({ params }: Params) {
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

  const editor = useEditor({
    extensions: editorExtensions,
    content: document?.editor_json,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert min-h-[420px] max-w-none rounded-xl border border-border bg-surface p-6 focus:outline-none",
      },
    },
  });

  const serializedDoc = useMemo(() => {
    if (!editor) {
      return document ? serializeStable(document.editor_json) : serializeStable({ type: "doc", content: [] });
    }
    return serializeStable(editor.getJSON() as EditorDoc);
  }, [document, editor]);

  const parsedVariables = asJsonObject(variablesText, document?.variables_json ?? {});
  const variableOutput = resolveTemplateVariables(variableRegistry, parsedVariables);
  const parsedRecipients = useMemo(() => {
    try {
      return JSON.parse(recipientsText) as Recipient[];
    } catch {
      return document?.recipients_json ?? [];
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

  async function loadDocument(targetDocumentId: string) {
    setError("");
    const response = await fetch(`/api/documents/${targetDocumentId}`);
    if (!response.ok) {
      setError("Failed to load document.");
      return;
    }
    const payload = (await response.json()) as { document: DocumentDetail };
    setDocument(payload.document);
    setContactId(payload.document.contact_id ?? "");
    setVariablesText(JSON.stringify(payload.document.variables_json, null, 2));
    setPricing(payload.document.pricing_json);
    setRecipientsText(JSON.stringify(payload.document.recipients_json, null, 2));
    const snapshot = JSON.stringify({
      doc: serializeStable(payload.document.editor_json),
      variables: JSON.stringify(payload.document.variables_json),
      pricing: JSON.stringify(payload.document.pricing_json),
      recipients: JSON.stringify(payload.document.recipients_json),
      contactId: payload.document.contact_id ?? "",
    });
    setLastSavedSnapshot(snapshot);
    if (editor) {
      editor.commands.setContent(payload.document.editor_json);
    }

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
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Save failed");
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
  }, [contactId, document, documentId, lastSavedSnapshot, parsedRecipients, parsedVariables, pricing, saveNow, serializedDoc]);

  return (
    <main className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Document Workspace</h1>
          <p className="text-sm text-muted">
            {documentId || "Loading..."} {document ? `(${document.status})` : ""}
          </p>
        </div>
        <Link href="/app/documents" className="rounded border border-border px-3 py-2 text-sm hover:bg-surface">
          Back to documents
        </Link>
      </div>

      {status ? <p className="text-sm text-green-600">{status}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <section className="space-y-3">
          <EditorContent editor={editor} />
          <div className="grid gap-2 rounded-xl border border-border bg-surface p-3 md:grid-cols-4">
            <button onClick={() => void saveNow()} className="rounded border border-border px-3 py-2 text-sm hover:bg-background">
              Save now
            </button>
            <button onClick={() => void sendDocument()} className="rounded border border-border px-3 py-2 text-sm hover:bg-background">
              Send
            </button>
            <button onClick={() => void finalizeDocument()} className="rounded border border-border px-3 py-2 text-sm hover:bg-background">
              Finalize
            </button>
            <button onClick={() => void exportArtifact()} className="rounded border border-border px-3 py-2 text-sm hover:bg-background">
              Export PDF
            </button>
            <button onClick={() => void openSigningSession()} className="rounded border border-border px-3 py-2 text-sm hover:bg-background md:col-span-4">
              Open signing session (first recipient)
            </button>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="mb-2 text-xs uppercase text-muted">Preview</p>
            <div
              className="prose prose-invert max-h-96 overflow-auto rounded border border-border bg-background p-3 text-xs"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </div>
        </section>

        <aside className="space-y-3">
          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="mb-2 text-xs uppercase text-muted">Contact Association</p>
            <select
              className="w-full rounded border border-border bg-background px-2 py-2 text-sm"
              value={contactId}
              onChange={(event) => {
                const nextContactId = event.target.value;
                setContactId(nextContactId);
                const selected = contacts.find((contact) => contact.id === nextContactId);
                if (selected) {
                  const current = asJsonObject(variablesText, {});
                  const next = {
                    ...current,
                    ...contactToVariables(selected),
                  };
                  setVariablesText(JSON.stringify(next, null, 2));
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

          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="mb-2 text-xs uppercase text-muted">Variables JSON</p>
            <textarea
              className="h-36 w-full rounded border border-border bg-background p-2 text-xs"
              value={variablesText}
              onChange={(event) => setVariablesText(event.target.value)}
            />
            <p className="mt-2 text-xs text-muted">
              Missing required: {variableOutput.missing.length ? variableOutput.missing.join(", ") : "none"}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="mb-2 text-xs uppercase text-muted">Recipients JSON</p>
            <textarea
              className="h-28 w-full rounded border border-border bg-background p-2 text-xs"
              value={recipientsText}
              onChange={(event) => setRecipientsText(event.target.value)}
            />
          </div>

          <div className="rounded-xl border border-border bg-surface p-3">
            <p className="mb-2 text-xs uppercase text-muted">Pricing</p>
            <label className="mb-2 block text-xs text-muted">
              Currency
              <input
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
                value={pricing.currency}
                onChange={(event) => setPricing((current) => ({ ...current, currency: event.target.value }))}
              />
            </label>
            <label className="mb-2 block text-xs text-muted">
              Discount %
              <input
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
                type="number"
                value={pricing.discountPercent ?? 0}
                onChange={(event) =>
                  setPricing((current) => ({ ...current, discountPercent: Number(event.target.value) }))
                }
              />
            </label>
            <label className="mb-2 block text-xs text-muted">
              Tax %
              <input
                className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs"
                type="number"
                value={pricing.taxPercent ?? 0}
                onChange={(event) => setPricing((current) => ({ ...current, taxPercent: Number(event.target.value) }))}
              />
            </label>
            <p className="text-xs text-muted">Total due now: {quoteTotals.totalDueNow.toFixed(2)}</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
