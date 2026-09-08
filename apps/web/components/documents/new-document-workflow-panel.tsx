"use client";

import { useEditor } from "@tiptap/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CreatorCanvas } from "@/components/editor/creator/creator-canvas";
import { CreatorFieldsSidebar } from "@/components/editor/creator/creator-fields-sidebar";
import { SignerRecipientProvider, withSenderRecipient } from "@/components/editor/signer-field-context";
import { creatorEditorProps } from "@/lib/editor/editor-config";
import { editorExtensions } from "@/lib/editor/extensions";
import { scheduleFocusDocumentStart } from "@/lib/editor/focus-document";
import { insertSignerFieldAtPoint, insertSignerFieldBlock } from "@/lib/editor/insert-signer-field";
import { migrateSignerFieldsDoc } from "@/lib/editor/migrate-signer-fields";
import { pageSizeFromDoc, type PageSizeId } from "@/lib/editor/page-geometry";
import { AUTOSAVE_DELAY_MS } from "@/lib/editor/autosave";
import {
  extractSigningFields,
  summarizeSigningFields,
  type SignerFieldEditorType,
} from "@/lib/editor/signer-field-attrs";
import type { EditorDoc } from "@/lib/editor/types";
import { resolveCompanyAssociation } from "@/lib/crm/resolve-company-association";
import { assetUrl } from "@/lib/storage/asset-url";
import { pageCountFromEditor, templateThumbnailKey } from "@/lib/ui/template-meta";

type StepId = 1 | 2 | 3 | 4;

type TemplateItem = {
  id: string;
  name: string;
  tags: string[];
  editor_json: EditorDoc;
  updated_at: string;
};

type ContactItem = {
  id: string;
  full_name: string;
  email: string;
  company_name: string | null;
  updated_at: string;
};

type SelectedRecipient = {
  id: string;
  name: string;
  email: string;
  contactId?: string | null;
};

type DocumentPayload = {
  id: string;
  status: string;
  editor_json: EditorDoc;
  recipients_json: Array<{ id: string; name: string; email: string; role: string }>;
};

const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: "Pick Template" },
  { id: 2, label: "Info" },
  { id: 3, label: "Edit" },
  { id: 4, label: "Deliver" },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function NewDocumentWorkflowPanel({ open, onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<StepId>(1);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [templateQuery, setTemplateQuery] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | "blank" | null>(null);
  const [title, setTitle] = useState("");
  const [recipients, setRecipients] = useState<SelectedRecipient[]>([]);
  const [contactQuery, setContactQuery] = useState("");
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [recentContacts, setRecentContacts] = useState<ContactItem[]>([]);
  const [showNewContact, setShowNewContact] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [document, setDocument] = useState<DocumentPayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [deliverySubject, setDeliverySubject] = useState("");
  const [deliveryMessage, setDeliveryMessage] = useState(
    "Hi {{recipient_full_name}},\n\nBelow is the link to the proposal. As you look through, please add any comments or questions. I look forward to your feedback!\n\nThanks,\n{{sender_full_name}}",
  );
  const [saveDefaultMessage, setSaveDefaultMessage] = useState(false);
  const [selectedRecipientId, setSelectedRecipientId] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setStep(1);
    setSelectedTemplateId(null);
    setTitle("");
    setRecipients([]);
    setDocumentId(null);
    setDocument(null);
    setError("");
    setSaveStatus("");
    setShowNewContact(false);
    setNewFirst("");
    setNewLast("");
    setNewEmail("");
    setNewCompany("");
    setNewPhone("");
    setTemplateQuery("");
    setContactQuery("");
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams({ limit: "40" });
      if (templateQuery.trim()) {
        params.set("q", templateQuery.trim());
      }
      const response = await fetch(`/api/templates?${params}`);
      if (!response.ok || cancelled) {
        return;
      }
      const data = (await response.json()) as { templates?: TemplateItem[] };
      if (!cancelled) {
        setTemplates(data.templates ?? []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, templateQuery]);

  useEffect(() => {
    if (!open || step !== 2) {
      return;
    }
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams({ limit: "20" });
      if (contactQuery.trim()) {
        params.set("q", contactQuery.trim());
      }
      const response = await fetch(`/api/contacts?${params}`);
      if (!response.ok || cancelled) {
        return;
      }
      const data = (await response.json()) as { contacts?: ContactItem[] };
      const list = data.contacts ?? [];
      if (cancelled) {
        return;
      }
      if (contactQuery.trim()) {
        setContacts(list);
      } else {
        setRecentContacts(list);
        setContacts(list);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, step, contactQuery]);

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  const fieldSummary = useMemo(() => {
    if (!document) {
      return summarizeSigningFields([]);
    }
    return summarizeSigningFields(extractSigningFields(document.editor_json), {
      senderRecipientIds: ["sender-self"],
    });
  }, [document]);

  const requiredActions = useMemo(() => {
    if (!document) {
      return [];
    }
    const fields = extractSigningFields(document.editor_json);
    const byId = new Map(document.recipients_json.map((r) => [r.id, r]));
    return fields.map((field) => {
      const assignee =
        field.recipientId === "sender-self"
          ? "Sender"
          : byId.get(field.recipientId)?.name || "Recipient";
      const typeLabel =
        field.type === "signature"
          ? "Signature"
          : field.type === "initial"
            ? "Initials"
            : field.type === "date"
              ? "Date"
              : field.type === "text"
                ? "Text"
                : field.type;
      return {
        id: field.fieldId,
        label: `${typeLabel}${field.required ? " (Required)" : ""}`,
        assignee,
      };
    });
  }, [document]);

  function addRecipient(contact: { id?: string; name: string; email: string }) {
    setRecipients((current) => {
      if (current.some((item) => item.email.toLowerCase() === contact.email.toLowerCase())) {
        return current;
      }
      return [
        ...current,
        {
          id: contact.id ?? `temp-${crypto.randomUUID()}`,
          name: contact.name,
          email: contact.email,
          contactId: contact.id ?? null,
        },
      ];
    });
  }

  async function createNewContact() {
    const name = `${newFirst.trim()} ${newLast.trim()}`.trim();
    if (!newFirst.trim() || !newLast.trim() || !newEmail.trim()) {
      setError("First name, last name, and email are required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const companyName = newCompany.trim();
      const company = companyName
        ? await resolveCompanyAssociation(companyName, "", {
            phone: newPhone.trim() || undefined,
          })
        : { company_id: null as string | null, company_name: null as string | null };

      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: newFirst.trim(),
          last_name: newLast.trim(),
          email: newEmail.trim(),
          phone: newPhone.trim() || undefined,
          company_name: company.company_name ?? undefined,
          company_id: company.company_id ?? undefined,
          source: "new-document-workflow",
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
        throw new Error(data.message || data.error || "Could not create contact");
      }
      const data = (await response.json()) as { contact?: ContactItem };
      const contact = data.contact;
      if (contact) {
        addRecipient({ id: contact.id, name: contact.full_name, email: contact.email });
        setRecentContacts((current) => [contact, ...current.filter((c) => c.id !== contact.id)].slice(0, 20));
      } else {
        addRecipient({ name, email: newEmail.trim() });
      }
      setShowNewContact(false);
      setNewFirst("");
      setNewLast("");
      setNewEmail("");
      setNewCompany("");
      setNewPhone("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create contact");
    } finally {
      setBusy(false);
    }
  }

  async function createDraftAndEdit() {
    if (!selectedTemplateId) {
      setError("Pick a template or blank document first");
      return;
    }
    if (!title.trim()) {
      setError("Add a document title");
      return;
    }
    if (recipients.length === 0) {
      setError("Add at least one recipient");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let created: DocumentPayload | null = null;
      if (selectedTemplateId === "blank") {
        const response = await fetch("/api/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!response.ok) {
          throw new Error("Could not create draft");
        }
        const data = (await response.json()) as { document?: DocumentPayload & { editor_json: EditorDoc } };
        if (!data.document) {
          throw new Error("Unexpected response");
        }
        const recipientsJson = recipients.map((item, index) => ({
          id: item.contactId || item.id || crypto.randomUUID(),
          name: item.name,
          email: item.email,
          role: "signer" as const,
          signing_order: index + 1,
        }));
        const patch = await fetch(`/api/documents/${data.document.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            editor_json: {
              ...data.document.editor_json,
              attrs: { ...(data.document.editor_json.attrs ?? {}), title: title.trim() },
            },
            recipients_json: recipientsJson,
            contact_id: recipients[0]?.contactId ?? null,
          }),
        });
        if (!patch.ok) {
          throw new Error("Could not save draft details");
        }
        const patched = (await patch.json()) as { document?: DocumentPayload };
        created = patched.document ?? {
          ...data.document,
          recipients_json: recipientsJson,
        };
      } else {
        const response = await fetch("/api/documents/from-template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: selectedTemplateId,
            title: title.trim(),
            recipients: recipients.map((item) => ({
              name: item.name,
              email: item.email,
              contactId: item.contactId ?? null,
            })),
          }),
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || "Could not create document");
        }
        const data = (await response.json()) as { document?: DocumentPayload };
        created = data.document ?? null;
      }
      if (!created) {
        throw new Error("Unexpected response");
      }
      setDocumentId(created.id);
      setDocument(created);
      setSelectedRecipientId(created.recipients_json[0]?.id ?? "");
      setDeliverySubject(`New proposal: ${title.trim()}`);
      setSaveStatus("Draft saved");
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create draft");
    } finally {
      setBusy(false);
    }
  }

  async function reloadDocument() {
    if (!documentId) {
      return;
    }
    const response = await fetch(`/api/documents/${documentId}`);
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as { document: DocumentPayload };
    setDocument(data.document);
  }

  async function deliverDocument() {
    if (!documentId) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/documents/${documentId}/send`, { method: "POST" });
      if (!response.ok) {
        throw new Error("Could not deliver document");
      }
      setSaveStatus("Delivered");
      onClose();
      router.push(`/app/documents/${documentId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not deliver");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="app-theme fixed inset-0 z-[90] flex flex-col bg-slate-900/40 pt-14" role="presentation">
      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden border-b border-border bg-background shadow-2xl transition-transform duration-300 ease-out"
        style={{ transform: "translateY(0)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-document-workflow-title"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3">
          <div className="min-w-0">
            <h2 id="new-document-workflow-title" className="text-sm font-semibold text-foreground">
              New Document
            </h2>
            <p className="truncate text-xs text-muted">
              {title.trim() || selectedTemplate?.name || "Create and deliver a proposal"}
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-1" aria-label="Workflow steps">
            {STEPS.map((item, index) => {
              const active = step === item.id;
              const done = step > item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.id > step && !documentId && item.id > 2}
                  onClick={() => {
                    if (item.id <= step || (documentId && item.id <= 4)) {
                      setStep(item.id);
                    }
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm font-bold transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : done
                        ? "bg-primary/10 text-primary hover:bg-primary/15"
                        : "text-muted hover:text-primary"
                  }`}
                >
                  {item.label}
                  {index < STEPS.length - 1 ? <span className="ml-1 opacity-50">›</span> : null}
                </button>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            {saveStatus ? (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <span aria-hidden>✓</span>
                {saveStatus}
              </span>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-sm text-primary hover:bg-primary/10"
            >
              Close
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-auto bg-[#f4f6f9] p-4 md:p-6">
          {error ? (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          {step === 1 ? (
            <StepPickTemplate
              templates={templates}
              query={templateQuery}
              onQueryChange={setTemplateQuery}
              selectedId={selectedTemplateId}
              onSelect={setSelectedTemplateId}
              onNext={() => {
                if (!selectedTemplateId) {
                  setError("Select a template or blank document");
                  return;
                }
                setError("");
                if (!title.trim() && selectedTemplate) {
                  setTitle(selectedTemplate.name);
                }
                setStep(2);
              }}
            />
          ) : null}

          {step === 2 ? (
            <StepRecipients
              title={title}
              onTitleChange={setTitle}
              contactQuery={contactQuery}
              onContactQueryChange={setContactQuery}
              contacts={contacts}
              recentContacts={recentContacts}
              recipients={recipients}
              onAddRecipient={addRecipient}
              onRemoveRecipient={(id) => setRecipients((current) => current.filter((item) => item.id !== id))}
              showNewContact={showNewContact}
              onToggleNewContact={() => setShowNewContact((value) => !value)}
              newFirst={newFirst}
              newLast={newLast}
              newEmail={newEmail}
              newCompany={newCompany}
              newPhone={newPhone}
              onNewFirst={setNewFirst}
              onNewLast={setNewLast}
              onNewEmail={setNewEmail}
              onNewCompany={setNewCompany}
              onNewPhone={setNewPhone}
              onCreateContact={() => void createNewContact()}
              busy={busy}
              onBack={() => setStep(1)}
              onNext={() => void createDraftAndEdit()}
            />
          ) : null}

          {step === 3 && documentId && document ? (
            <StepEdit
              documentId={documentId}
              initialDoc={document.editor_json}
              recipients={document.recipients_json}
              selectedRecipientId={selectedRecipientId}
              onSelectRecipient={setSelectedRecipientId}
              onSaved={(status) => setSaveStatus(status)}
              onDocumentChange={(doc) => setDocument((current) => (current ? { ...current, editor_json: doc } : current))}
              onBack={() => setStep(2)}
              onNext={() => {
                void reloadDocument();
                setStep(4);
              }}
            />
          ) : null}

          {step === 4 && document ? (
            <StepDeliver
              title={title}
              document={document}
              requiredActions={requiredActions}
              fieldSummary={fieldSummary}
              deliverySubject={deliverySubject}
              onSubjectChange={setDeliverySubject}
              deliveryMessage={deliveryMessage}
              onMessageChange={setDeliveryMessage}
              saveDefaultMessage={saveDefaultMessage}
              onSaveDefaultMessageChange={setSaveDefaultMessage}
              busy={busy}
              onBack={() => setStep(3)}
              onDeliver={() => void deliverDocument()}
              onDeliverMyself={() => {
                onClose();
                if (documentId) {
                  router.push(`/app/documents/${documentId}`);
                }
              }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StepPickTemplate({
  templates,
  query,
  onQueryChange,
  selectedId,
  onSelect,
  onNext,
}: {
  templates: TemplateItem[];
  query: string;
  onQueryChange: (value: string) => void;
  selectedId: string | "blank" | null;
  onSelect: (id: string | "blank") => void;
  onNext: () => void;
}) {
  const [viewMode, setViewMode] = useState<"list" | "preview">("list");
  const toggleBtn =
    "inline-flex h-8 w-8 items-center justify-center rounded text-sm font-medium transition-colors";

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">1. Pick Template</h3>
          <p className="text-sm text-muted">Choose a library template or start from a blank page.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex h-8 items-center rounded-md border border-primary bg-surface p-0.5"
            role="group"
            aria-label="View mode"
          >
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`${toggleBtn} ${
                viewMode === "list"
                  ? "bg-primary text-primary-foreground"
                  : "text-primary hover:bg-primary/10"
              }`}
              aria-label="List view"
              aria-pressed={viewMode === "list"}
              title="List view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M8 6h12M8 12h12M8 18h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                <path d="M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("preview")}
              className={`${toggleBtn} ${
                viewMode === "preview"
                  ? "bg-primary text-primary-foreground"
                  : "text-primary hover:bg-primary/10"
              }`}
              aria-label="Preview view"
              aria-pressed={viewMode === "preview"}
              title="Preview view"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </button>
          </div>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search templates"
            className="h-9 w-full max-w-xs rounded-md border border-border bg-surface px-3 text-sm outline-none focus:border-primary/40"
          />
        </div>
      </div>

      {viewMode === "list" ? (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2.5 font-medium">Document Title</th>
                <th className="px-3 py-2.5 font-medium">Pages</th>
                <th className="px-3 py-2.5 font-medium">Last Modified</th>
              </tr>
            </thead>
            <tbody>
              <tr
                className={`cursor-pointer border-t border-border ${
                  selectedId === "blank" ? "bg-primary/5" : "hover:bg-slate-50"
                }`}
                onClick={() => onSelect("blank")}
              >
                <td className="px-3 py-2.5 font-medium text-foreground">Blank document</td>
                <td className="px-3 py-2.5 text-muted">1</td>
                <td className="px-3 py-2.5 text-muted" />
              </tr>
              {templates.map((template) => {
                const pages = pageCountFromEditor(template.editor_json);
                const selected = selectedId === template.id;
                return (
                  <tr
                    key={template.id}
                    className={`cursor-pointer border-t border-border ${
                      selected ? "bg-primary/5" : "hover:bg-slate-50"
                    }`}
                    onClick={() => onSelect(template.id)}
                  >
                    <td className="px-3 py-2.5 font-medium text-foreground">{template.name}</td>
                    <td className="px-3 py-2.5 text-muted">{pages}</td>
                    <td className="px-3 py-2.5 text-muted">
                      {new Intl.DateTimeFormat(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }).format(new Date(template.updated_at))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
          <button
            type="button"
            onClick={() => onSelect("blank")}
            className={`flex flex-col overflow-hidden rounded-lg border bg-surface text-left shadow-sm ${
              selectedId === "blank" ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
            }`}
          >
            <div className="flex aspect-[4/5] items-center justify-center bg-slate-100 text-sm text-muted">Blank</div>
            <div className="border-t border-border p-2.5">
              <p className="truncate text-sm font-semibold text-foreground">Blank document</p>
            </div>
          </button>
          {templates.map((template) => {
            const thumb = templateThumbnailKey(template.editor_json);
            const pages = pageCountFromEditor(template.editor_json);
            const selected = selectedId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => onSelect(template.id)}
                className={`flex flex-col overflow-hidden rounded-lg border bg-surface text-left shadow-sm ${
                  selected ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"
                }`}
              >
                <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-slate-100">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={assetUrl(thumb)} alt="" className="h-full w-full object-cover object-top" />
                  ) : (
                    <span className="text-xs text-muted">{pages} pg</span>
                  )}
                </div>
                <div className="border-t border-border p-2.5">
                  <p className="truncate text-sm font-semibold text-foreground">{template.name}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onNext}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
        >
          Next Step
        </button>
      </div>
    </div>
  );
}

function StepRecipients({
  title,
  onTitleChange,
  contactQuery,
  onContactQueryChange,
  contacts,
  recentContacts,
  recipients,
  onAddRecipient,
  onRemoveRecipient,
  showNewContact,
  onToggleNewContact,
  newFirst,
  newLast,
  newEmail,
  newCompany,
  newPhone,
  onNewFirst,
  onNewLast,
  onNewEmail,
  onNewCompany,
  onNewPhone,
  onCreateContact,
  busy,
  onBack,
  onNext,
}: {
  title: string;
  onTitleChange: (value: string) => void;
  contactQuery: string;
  onContactQueryChange: (value: string) => void;
  contacts: ContactItem[];
  recentContacts: ContactItem[];
  recipients: SelectedRecipient[];
  onAddRecipient: (contact: { id?: string; name: string; email: string }) => void;
  onRemoveRecipient: (id: string) => void;
  showNewContact: boolean;
  onToggleNewContact: () => void;
  newFirst: string;
  newLast: string;
  newEmail: string;
  newCompany: string;
  newPhone: string;
  onNewFirst: (value: string) => void;
  onNewLast: (value: string) => void;
  onNewEmail: (value: string) => void;
  onNewCompany: (value: string) => void;
  onNewPhone: (value: string) => void;
  onCreateContact: () => void;
  busy: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const tableContacts = contactQuery.trim() ? contacts : recentContacts;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h3 className="text-base font-semibold text-foreground">2. Document info & recipients</h3>
        <p className="text-sm text-muted">Name the document and add signers from CRM People.</p>
      </div>

      <label className="block text-xs font-medium text-muted">
        Document title
        <input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          className="mt-1 h-10 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary/40"
          placeholder="e.g. Master Services Agreement"
        />
      </label>

      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="block min-w-[14rem] flex-1 text-xs font-medium text-muted">
            Search contacts
            <input
              value={contactQuery}
              onChange={(event) => onContactQueryChange(event.target.value)}
              className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/40"
              placeholder="Browse CRM → People"
            />
          </label>
          <button
            type="button"
            onClick={onToggleNewContact}
            className="mt-5 rounded-md border border-primary bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-95"
          >
            + New Contact
          </button>
        </div>

        {showNewContact ? (
          <div className="mt-3 grid gap-2 rounded-lg border border-border bg-background p-3 md:grid-cols-3">
            <input
              value={newFirst}
              onChange={(event) => onNewFirst(event.target.value)}
              placeholder="First name"
              className="h-9 rounded-md border border-border px-2 text-sm"
            />
            <input
              value={newLast}
              onChange={(event) => onNewLast(event.target.value)}
              placeholder="Last name"
              className="h-9 rounded-md border border-border px-2 text-sm"
            />
            <input
              value={newEmail}
              onChange={(event) => onNewEmail(event.target.value)}
              placeholder="Email"
              type="email"
              className="h-9 rounded-md border border-border px-2 text-sm"
            />
            <input
              value={newCompany}
              onChange={(event) => onNewCompany(event.target.value)}
              placeholder="Company Name"
              className="h-9 rounded-md border border-border px-2 text-sm"
            />
            <input
              value={newPhone}
              onChange={(event) => onNewPhone(event.target.value)}
              placeholder="Phone Number"
              type="tel"
              className="h-9 rounded-md border border-border px-2 text-sm md:col-span-2"
            />
            <div className="md:col-span-3 flex justify-end">
              <button
                type="button"
                disabled={busy}
                onClick={onCreateContact}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                Add contact
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Email</th>
                <th className="px-3 py-2 font-medium">Company</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {tableContacts.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-muted">
                    No contacts yet. Create one or search People.
                  </td>
                </tr>
              ) : (
                tableContacts.map((contact) => (
                  <tr key={contact.id} className="border-t border-border">
                    <td className="px-3 py-2 font-medium text-foreground">{contact.full_name}</td>
                    <td className="px-3 py-2 text-muted">{contact.email}</td>
                    <td className="px-3 py-2 text-muted">{contact.company_name || ""}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-xs font-medium text-primary hover:underline"
                        onClick={() =>
                          onAddRecipient({
                            id: contact.id,
                            name: contact.full_name,
                            email: contact.email,
                          })
                        }
                      >
                        Add
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h4 className="text-sm font-semibold text-foreground">Recipients</h4>
        {recipients.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Selected contacts will appear here as signers.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {recipients.map((recipient) => (
              <li key={recipient.id} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{recipient.name}</p>
                  <p className="text-xs text-muted">{recipient.email}</p>
                </div>
                <button
                  type="button"
                  className="text-xs text-muted hover:text-red-600"
                  onClick={() => onRemoveRecipient(recipient.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-primary/30 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
        >
          Back
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onNext}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60"
        >
          {busy ? "Creating draft…" : "Next Step"}
        </button>
      </div>
    </div>
  );
}

function StepEdit({
  documentId,
  initialDoc,
  recipients,
  selectedRecipientId,
  onSelectRecipient,
  onSaved,
  onDocumentChange,
  onBack,
  onNext,
}: {
  documentId: string;
  initialDoc: EditorDoc;
  recipients: Array<{ id: string; name: string; email: string; role: string }>;
  selectedRecipientId: string;
  onSelectRecipient: (id: string) => void;
  onSaved: (status: string) => void;
  onDocumentChange: (doc: EditorDoc) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [pageSize] = useState<PageSizeId>(() => pageSizeFromDoc(initialDoc));
  const saveTimer = useMemo(() => ({ id: 0 as ReturnType<typeof setTimeout> | 0 }), []);

  const editor = useEditor({
    extensions: editorExtensions,
    content: migrateSignerFieldsDoc(initialDoc),
    immediatelyRender: false,
    editorProps: creatorEditorProps,
    onCreate: ({ editor: instance }) => scheduleFocusDocumentStart(instance),
    onUpdate: ({ editor: instance }) => {
      const json = instance.getJSON() as EditorDoc;
      onDocumentChange(json);
      if (saveTimer.id) {
        clearTimeout(saveTimer.id);
      }
      saveTimer.id = setTimeout(() => {
        void (async () => {
          const response = await fetch(`/api/documents/${documentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ editor_json: json }),
          });
          if (response.ok) {
            onSaved("Draft saved");
          }
        })();
      }, AUTOSAVE_DELAY_MS);
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimer.id) {
        clearTimeout(saveTimer.id);
      }
    };
  }, [saveTimer]);

  const insertField = useCallback(
    (type: SignerFieldEditorType) => {
      if (!editor || !selectedRecipientId) {
        return;
      }
      insertSignerFieldBlock(editor, { recipientId: selectedRecipientId, type });
    },
    [editor, selectedRecipientId],
  );

  const recipientOptions = withSenderRecipient(
    recipients.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      role: item.role === "sender" ? ("sender" as const) : ("signer" as const),
    })),
  );

  return (
    <div className="flex h-[min(70vh,720px)] min-h-[28rem] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-foreground">3. Edit document</h3>
          <p className="text-sm text-muted">
            Draft is saved as you edit. You can close anytime and resume later.
          </p>
        </div>
        <Link href={`/app/documents/${documentId}`} className="text-sm font-medium text-primary hover:underline">
          Open full editor
        </Link>
      </div>

      <SignerRecipientProvider recipients={recipientOptions}>
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-slate-200/70 p-4">
            {editor ? (
              <CreatorCanvas
                editor={editor}
                pageSize={pageSize}
                documentId={documentId}
                onDropField={(type, clientX, clientY) => {
                  if (!selectedRecipientId) {
                    return;
                  }
                  insertSignerFieldAtPoint(editor, {
                    recipientId: selectedRecipientId,
                    type: type as SignerFieldEditorType,
                    clientX,
                    clientY,
                  });
                }}
              />
            ) : null}
          </div>
          <CreatorFieldsSidebar
            editor={editor}
            recipients={recipientOptions}
            selectedRecipientId={selectedRecipientId || recipientOptions[0]?.id || ""}
            onSelectRecipient={onSelectRecipient}
            onInsertField={insertField}
            missingVariableCount={0}
            unassignedRoleCount={0}
          />
        </div>
      </SignerRecipientProvider>

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-primary/30 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/10"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
        >
          Next: Deliver
        </button>
      </div>
    </div>
  );
}

function StepDeliver({
  title,
  document,
  requiredActions,
  fieldSummary,
  deliverySubject,
  onSubjectChange,
  deliveryMessage,
  onMessageChange,
  saveDefaultMessage,
  onSaveDefaultMessageChange,
  busy,
  onBack,
  onDeliver,
  onDeliverMyself,
}: {
  title: string;
  document: DocumentPayload;
  requiredActions: Array<{ id: string; label: string; assignee: string }>;
  fieldSummary: ReturnType<typeof summarizeSigningFields>;
  deliverySubject: string;
  onSubjectChange: (value: string) => void;
  deliveryMessage: string;
  onMessageChange: (value: string) => void;
  saveDefaultMessage: boolean;
  onSaveDefaultMessageChange: (value: boolean) => void;
  busy: boolean;
  onBack: () => void;
  onDeliver: () => void;
  onDeliverMyself: () => void;
}) {
  return (
    <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <div className="space-y-3">
        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Required Actions</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {requiredActions.length}
            </span>
          </div>
          {requiredActions.length === 0 ? (
            <p className="text-sm text-muted">No fillable fields on this document yet.</p>
          ) : (
            <ul className="space-y-2">
              {requiredActions.map((action) => (
                <li key={action.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-foreground">{action.label}</span>
                  <span className="text-muted">{action.assignee}</span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted">
            Sender: {fieldSummary.sender} · Recipients: {fieldSummary.recipients}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Enable Acceptance</h3>
          <ul className="space-y-2">
            {document.recipients_json.map((recipient) => (
              <li key={recipient.id} className="flex items-start gap-2 rounded-lg border border-border px-3 py-2">
                <input type="checkbox" defaultChecked className="mt-1 accent-[var(--primary)]" readOnly />
                <div>
                  <p className="text-sm font-medium text-foreground">{recipient.name}</p>
                  <p className="text-xs text-muted">{recipient.email}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Proposal Expiration</h3>
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">Off</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-foreground">Delivery Message</h3>
        <p className="mt-1 text-xs text-muted">{title || "Untitled document"}</p>

        <label className="mt-4 block text-xs font-medium text-muted">
          Subject
          <input
            value={deliverySubject}
            onChange={(event) => onSubjectChange(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/40"
          />
        </label>

        <label className="mt-3 block text-xs font-medium text-muted">
          Delivery Message
          <textarea
            value={deliveryMessage}
            onChange={(event) => onMessageChange(event.target.value)}
            rows={12}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm leading-relaxed outline-none focus:border-primary/40"
          />
        </label>

        <label className="mt-3 flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={saveDefaultMessage}
            onChange={(event) => onSaveDefaultMessageChange(event.target.checked)}
          />
          Save as my default message
        </label>

        <div className="mt-4 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={onDeliver}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-95 disabled:opacity-60"
          >
            ✈ Deliver
          </button>
          <button
            type="button"
            onClick={onDeliverMyself}
            className="w-full rounded-md border border-primary bg-surface px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10"
          >
            I&apos;ll deliver it myself
          </button>
          <button
            type="button"
            onClick={onBack}
            className="w-full py-2 text-sm font-medium text-primary hover:bg-primary/10"
          >
            Back to edit
          </button>
        </div>
      </div>
    </div>
  );
}
