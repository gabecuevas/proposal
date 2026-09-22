"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DocumentInfoRecipientsHeading } from "@/components/documents/document-info-recipients-heading";
import { NewContactModal } from "@/components/documents/new-contact-modal";
import type { EditorDoc } from "@/lib/editor/types";
import { applyDocumentMetaToDoc } from "@/lib/ui/document-title";

type ContactOption = {
  id: string;
  full_name: string;
  email: string;
  company_name?: string | null;
};

type SelectedRecipient = {
  id: string;
  name: string;
  email: string;
  companyName?: string | null;
  contactId?: string | null;
};

type Props = {
  open: boolean;
  templateId: string;
  templateName: string;
  onClose: () => void;
};

export function UseTemplateRecipientModal({ open, templateId, templateName, onClose }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [contacts, setContacts] = useState<ContactOption[]>([]);
  const [recentContacts, setRecentContacts] = useState<ContactOption[]>([]);
  const [query, setQuery] = useState("");
  const [recipients, setRecipients] = useState<SelectedRecipient[]>([]);
  const [newContactOpen, setNewContactOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [loadingContacts, setLoadingContacts] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(templateName.trim() || "");
    setDueDate("");
    setQuery("");
    setRecipients([]);
    setNewContactOpen(false);
    setError("");
    setBusy(false);
  }, [open, templateId, templateName]);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingContacts(true);
      try {
        const params = new URLSearchParams({ limit: "50" });
        if (query.trim()) {
          params.set("q", query.trim());
        }
        const response = await fetch(`/api/contacts?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Could not load contacts");
        }
        const data = (await response.json()) as { contacts?: ContactOption[] };
        const list = data.contacts ?? [];
        if (cancelled) {
          return;
        }
        if (query.trim()) {
          setContacts(list);
        } else {
          setRecentContacts(list);
          setContacts(list);
        }
      } catch {
        if (!cancelled) {
          setContacts([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingContacts(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy && !newContactOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, newContactOpen, onClose, open]);

  function addRecipient(contact: {
    id?: string;
    name: string;
    email: string;
    companyName?: string | null;
  }) {
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
          companyName: contact.companyName ?? null,
          contactId: contact.id ?? null,
        },
      ];
    });
    setError("");
  }

  const continueToDocument = useCallback(async () => {
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
      const response = await fetch("/api/documents/from-template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          title: title.trim(),
          recipients: recipients.map((item) => ({
            name: item.name,
            email: item.email,
            contactId: item.contactId ?? null,
            companyName: item.companyName ?? null,
          })),
        }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Could not create document");
      }
      const data = (await response.json()) as {
        document?: { id: string; editor_json?: EditorDoc };
      };
      const created = data.document;
      if (!created?.id) {
        throw new Error("Unexpected response");
      }

      if (dueDate.trim() && created.editor_json) {
        await fetch(`/api/documents/${created.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            editor_json: applyDocumentMetaToDoc(created.editor_json, {
              title: title.trim(),
              dueDate: dueDate.trim() || null,
            }),
            contact_id: recipients[0]?.contactId ?? null,
          }),
        });
      }

      router.push(`/app/documents/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create document");
      setBusy(false);
    }
  }, [dueDate, recipients, router, templateId, title]);

  if (!open) {
    return null;
  }

  const tableContacts = query.trim() ? contacts : recentContacts;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-900/40 p-4 pt-16"
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
        aria-labelledby="use-template-recipient-title"
        className="flex max-h-[min(88vh,44rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-3">
          <DocumentInfoRecipientsHeading headingId="use-template-recipient-title" />
          <button
            type="button"
            className="shrink-0 rounded px-2 py-1 text-sm text-muted hover:bg-slate-100 hover:text-foreground"
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-5 py-4">
          <div className="grid shrink-0 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-muted">
              Document title
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary/40"
                placeholder="e.g. Master Services Agreement"
                disabled={busy}
              />
            </label>
            <label className="block text-xs font-medium text-muted">
              Due date
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary/40"
                disabled={busy}
              />
            </label>
          </div>

          <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-surface p-3 shadow-sm">
            <div className="flex shrink-0 flex-wrap items-end gap-2">
              <label className="block min-w-[12rem] flex-1 text-xs font-medium text-muted">
                Search contacts
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary/40"
                  placeholder="Browse CRM → People"
                  disabled={busy}
                />
              </label>
              <button
                type="button"
                onClick={() => setNewContactOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-primary bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-95"
                disabled={busy}
              >
                <span aria-hidden>+</span>
                New Contact
              </button>
            </div>

            <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Company</th>
                    <th className="px-3 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {loadingContacts ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-muted">
                        Loading contacts…
                      </td>
                    </tr>
                  ) : tableContacts.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-muted">
                        No contacts yet. Create one or search People.
                      </td>
                    </tr>
                  ) : (
                    tableContacts.map((contact) => (
                      <tr key={contact.id} className="border-t border-border">
                        <td className="px-3 py-1.5 font-medium text-foreground">{contact.full_name}</td>
                        <td className="px-3 py-1.5 text-muted">{contact.email}</td>
                        <td className="px-3 py-1.5 text-muted">{contact.company_name || ""}</td>
                        <td className="px-3 py-1.5 text-right">
                          <button
                            type="button"
                            className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                            disabled={busy}
                            onClick={() =>
                              addRecipient({
                                id: contact.id,
                                name: contact.full_name,
                                email: contact.email,
                                companyName: contact.company_name,
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

          <div className="shrink-0 rounded-xl border border-border bg-surface px-3 py-2.5 shadow-sm">
            <h4 className="text-sm font-semibold text-foreground">
              Recipients <span className="text-red-600">*</span>
            </h4>
            <p className="mt-0.5 text-xs text-muted">
              Required — add at least one recipient to continue and save a draft.
            </p>
            {recipients.length === 0 ? (
              <p className="mt-1.5 text-sm text-muted">Selected contacts will appear here as recipients.</p>
            ) : (
              <ul className="mt-1.5 max-h-24 divide-y divide-border overflow-y-auto">
                {recipients.map((recipient) => (
                  <li key={recipient.id} className="flex items-center justify-between gap-3 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{recipient.name}</p>
                      <p className="truncate text-xs text-muted">
                        {recipient.email}
                        {recipient.companyName ? ` · ${recipient.companyName}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 text-xs font-medium text-muted hover:text-red-600"
                      disabled={busy}
                      onClick={() =>
                        setRecipients((current) => current.filter((item) => item.id !== recipient.id))
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {error ? <p className="shrink-0 text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
          <button
            type="button"
            className="rounded-md px-3 py-1.5 text-sm text-muted hover:bg-slate-100 hover:text-foreground"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-95 disabled:opacity-60"
            disabled={busy || recipients.length === 0 || !title.trim()}
            onClick={() => void continueToDocument()}
          >
            {busy ? "Opening document…" : "Continue to document"}
          </button>
        </div>
      </div>

      <NewContactModal
        open={newContactOpen}
        source="template-recipient"
        onClose={() => setNewContactOpen(false)}
        onCreated={(contact) => {
          addRecipient({
            id: contact.id,
            name: contact.full_name,
            email: contact.email,
            companyName: contact.company_name,
          });
          setRecentContacts((current) => [contact, ...current.filter((item) => item.id !== contact.id)]);
          setContacts((current) => [contact, ...current.filter((item) => item.id !== contact.id)]);
        }}
      />
    </div>
  );
}
