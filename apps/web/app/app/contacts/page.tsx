"use client";

import { useEffect, useState } from "react";

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
  const [query, setQuery] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
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

  async function loadContacts(search = query) {
    setError("");
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (search.trim()) {
      params.set("q", search.trim());
    }
    const response = await fetch(`/api/contacts?${params.toString()}`);
    if (!response.ok) {
      setError("Failed to load contacts");
      return;
    }
    const payload = (await response.json()) as { contacts: ContactRecord[] };
    setContacts(payload.contacts);
    if (!selectedContactId && payload.contacts[0]) {
      setSelectedContactId(payload.contacts[0].id);
      setEditor(toEditState(payload.contacts[0]));
    }
  }

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
    await loadContacts();
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

  useEffect(() => {
    void loadContacts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = contacts.find((contact) => contact.id === selectedContactId);

  return (
    <main className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <div>
          <h1 className="text-xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted">Search and manage contacts as placeholder data sources.</p>
        </div>
        <div className="flex gap-2">
          <input
            className="w-full rounded border border-border bg-background px-3 py-2 text-sm"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, company"
          />
          <button
            onClick={() => void loadContacts()}
            className="rounded border border-border px-3 py-2 text-sm hover:bg-background"
          >
            Search
          </button>
        </div>
        <div className="space-y-2">
          {contacts.map((contact) => (
            <button
              key={contact.id}
              onClick={() => {
                setSelectedContactId(contact.id);
                setEditor(toEditState(contact));
              }}
              className={`w-full rounded border p-2 text-left text-sm ${
                selectedContactId === contact.id ? "border-primary bg-background" : "border-border bg-background"
              }`}
            >
              <p className="font-medium">{contact.full_name}</p>
              <p className="text-xs text-muted">{contact.email}</p>
            </button>
          ))}
          {contacts.length === 0 ? <p className="text-sm text-muted">No contacts found.</p> : null}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-lg font-semibold">{selected ? "Edit contact" : "Create contact"}</h2>
        <div className="grid gap-2 md:grid-cols-2">
          <input
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={editor.first_name}
            onChange={(event) => setEditor((current) => ({ ...current, first_name: event.target.value }))}
            placeholder="First name"
          />
          <input
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={editor.last_name}
            onChange={(event) => setEditor((current) => ({ ...current, last_name: event.target.value }))}
            placeholder="Last name"
          />
          <input
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={editor.email}
            onChange={(event) => setEditor((current) => ({ ...current, email: event.target.value }))}
            placeholder="Email"
          />
          <input
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={editor.phone}
            onChange={(event) => setEditor((current) => ({ ...current, phone: event.target.value }))}
            placeholder="Phone"
          />
          <input
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={editor.company_name}
            onChange={(event) => setEditor((current) => ({ ...current, company_name: event.target.value }))}
            placeholder="Company"
          />
          <input
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={editor.title}
            onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))}
            placeholder="Title"
          />
          <input
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={editor.tagsCsv}
            onChange={(event) => setEditor((current) => ({ ...current, tagsCsv: event.target.value }))}
            placeholder="Tags (comma-separated)"
          />
          <input
            className="rounded border border-border bg-background px-3 py-2 text-sm"
            value={editor.color_label}
            onChange={(event) => setEditor((current) => ({ ...current, color_label: event.target.value }))}
            placeholder="Color label"
          />
        </div>
        <textarea
          className="h-24 w-full rounded border border-border bg-background px-3 py-2 text-sm"
          value={editor.notes}
          onChange={(event) => setEditor((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Notes"
        />

        <div className="flex gap-2">
          {selected ? (
            <button
              onClick={() => void saveContact()}
              className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              Save contact
            </button>
          ) : (
            <button
              onClick={() => void createContact()}
              className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
            >
              Create contact
            </button>
          )}
          <button
            onClick={() => {
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
            }}
            className="rounded border border-border px-3 py-2 text-sm hover:bg-background"
          >
            New
          </button>
        </div>
        {statusMessage ? <p className="text-sm text-green-600">{statusMessage}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </section>
    </main>
  );
}
