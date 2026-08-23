"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatRelativeContact } from "@/lib/ui/time";

type ContactRecord = {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  title: string | null;
  notes: string | null;
  tags: string[];
  color_label: string | null;
  updated_at: string;
};

type EditableContact = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company_name: string;
  title: string;
  notes: string;
  tagsCsv: string;
  color_label: string;
};

type DocRow = { contact_id: string | null };

function toEditState(contact: ContactRecord): EditableContact {
  return {
    first_name: contact.first_name,
    last_name: contact.last_name,
    email: contact.email,
    phone: contact.phone ?? "",
    company_name: contact.company_name ?? "",
    title: contact.title ?? "",
    notes: contact.notes ?? "",
    tagsCsv: contact.tags.join(","),
    color_label: contact.color_label ?? "",
  };
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [docCounts, setDocCounts] = useState<Record<string, number>>({});
  const [query, setQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editor, setEditor] = useState<EditableContact>({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    company_name: "",
    title: "",
    notes: "",
    tagsCsv: "",
    color_label: "",
  });
  const [statusMessage, setStatusMessage] = useState("");
  const [error, setError] = useState("");

  const loadContacts = useCallback(async () => {
    setError("");
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (query.trim()) {
      params.set("q", query.trim());
    }
    const response = await fetch(`/api/contacts?${params.toString()}`);
    if (!response.ok) {
      setError("Failed to load contacts");
      return;
    }
    const payload = (await response.json()) as { contacts: ContactRecord[] };
    setContacts(payload.contacts);
  }, [query]);

  const loadDocCounts = useCallback(async () => {
    const response = await fetch("/api/documents?limit=500");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { documents: DocRow[] };
    const map: Record<string, number> = {};
    for (const row of payload.documents) {
      if (row.contact_id) {
        map[row.contact_id] = (map[row.contact_id] ?? 0) + 1;
      }
    }
    setDocCounts(map);
  }, []);

  useEffect(() => {
    void loadContacts();
    void loadDocCounts();
  }, [loadContacts, loadDocCounts]);

  async function createContact() {
    setStatusMessage("");
    setError("");
    const response = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: editor.first_name,
        last_name: editor.last_name,
        email: editor.email,
        phone: editor.phone || undefined,
        company_name: editor.company_name || undefined,
        title: editor.title || undefined,
        notes: editor.notes || undefined,
        tags: editor.tagsCsv
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        color_label: editor.color_label || undefined,
      }),
    });
    if (!response.ok) {
      setError("Failed to create contact");
      return;
    }
    setStatusMessage("Contact created.");
    setShowForm(false);
    await loadContacts();
    await loadDocCounts();
  }

  async function saveContact() {
    if (!selectedContactId) {
      return;
    }
    setStatusMessage("");
    setError("");
    const response = await fetch(`/api/contacts/${selectedContactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: editor.first_name,
        last_name: editor.last_name,
        email: editor.email,
        phone: editor.phone || undefined,
        company_name: editor.company_name || undefined,
        title: editor.title || undefined,
        notes: editor.notes || undefined,
        tags: editor.tagsCsv
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        color_label: editor.color_label || undefined,
      }),
    });
    if (!response.ok) {
      setError("Failed to save contact");
      return;
    }
    setStatusMessage("Contact saved.");
    await loadContacts();
  }

  const selected = contacts.find((c) => c.id === selectedContactId);

  const openAdd = () => {
    setSelectedContactId("");
    setEditor({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      company_name: "",
      title: "",
      notes: "",
      tagsCsv: "",
      color_label: "",
    });
    setShowForm(true);
  };

  const openRow = (contact: ContactRecord) => {
    setSelectedContactId(contact.id);
    setEditor(toEditState(contact));
    setShowForm(true);
  };

  const sortedContacts = useMemo(() => [...contacts], [contacts]);

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-app-serif text-3xl font-normal tracking-tight text-foreground md:text-4xl">
          Contacts
        </h1>
        <button
          type="button"
          onClick={() => openAdd()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
        >
          + Add contact
        </button>
      </div>

      <div className="relative max-w-xl">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <input
          className="h-10 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none ring-primary/15 focus:ring-2"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void loadContacts()}
          placeholder="Search contacts…"
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Docs</th>
              <th className="px-4 py-3">Last active</th>
              <th className="w-10 px-2 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {sortedContacts.map((contact) => (
              <tr
                key={contact.id}
                className={`cursor-pointer border-b border-border last:border-0 hover:bg-slate-50/60 ${
                  selectedContactId === contact.id ? "bg-sky-50/50" : ""
                }`}
                onClick={() => openRow(contact)}
                onKeyDown={(e) => e.key === "Enter" && openRow(contact)}
                tabIndex={0}
                role="button"
              >
                <td className="px-4 py-3 font-semibold text-foreground">{contact.full_name}</td>
                <td className="px-4 py-3 text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 opacity-60" aria-hidden>
                      <path
                        d="M4 6h16v12H4V6zm0 0l8 6 8-6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {contact.email}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0 opacity-60" aria-hidden>
                      <path
                        d="M4 21V7l8-4 8 4v14M9 21V12h6v9"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinejoin="round"
                      />
                    </svg>
                    {contact.company_name ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 tabular-nums text-muted">{docCounts[contact.id] ?? 0}</td>
                <td className="px-4 py-3 text-muted">{formatRelativeContact(contact.updated_at)}</td>
                <td className="px-2 py-3 text-center text-muted">···</td>
              </tr>
            ))}
          </tbody>
        </table>
        {sortedContacts.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No contacts yet.</p>
        ) : null}
      </div>

      {showForm ? (
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-foreground">
            {selected ? "Edit contact" : "New contact"}
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={editor.first_name}
              onChange={(event) => setEditor((c) => ({ ...c, first_name: event.target.value }))}
              placeholder="First name"
            />
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={editor.last_name}
              onChange={(event) => setEditor((c) => ({ ...c, last_name: event.target.value }))}
              placeholder="Last name"
            />
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
              value={editor.email}
              onChange={(event) => setEditor((c) => ({ ...c, email: event.target.value }))}
              placeholder="Email"
            />
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={editor.phone}
              onChange={(event) => setEditor((c) => ({ ...c, phone: event.target.value }))}
              placeholder="Phone"
            />
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={editor.company_name}
              onChange={(event) => setEditor((c) => ({ ...c, company_name: event.target.value }))}
              placeholder="Company"
            />
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
              value={editor.title}
              onChange={(event) => setEditor((c) => ({ ...c, title: event.target.value }))}
              placeholder="Title"
            />
            <input
              className="rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
              value={editor.tagsCsv}
              onChange={(event) => setEditor((c) => ({ ...c, tagsCsv: event.target.value }))}
              placeholder="Tags (comma-separated)"
            />
            <textarea
              className="min-h-[88px] rounded-md border border-border bg-background px-3 py-2 text-sm md:col-span-2"
              value={editor.notes}
              onChange={(event) => setEditor((c) => ({ ...c, notes: event.target.value }))}
              placeholder="Notes"
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {selected ? (
              <button
                type="button"
                onClick={() => void saveContact()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Save contact
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void createContact()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Create contact
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-background"
            >
              Close
            </button>
          </div>
          {statusMessage ? <p className="mt-3 text-sm text-emerald-700">{statusMessage}</p> : null}
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </section>
      ) : null}
    </main>
  );
}
