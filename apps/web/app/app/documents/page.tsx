"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type DocumentItem = {
  id: string;
  status: string;
  template_id: string | null;
  created_at: string;
  updated_at: string;
};

type TemplateOption = {
  id: string;
  name: string;
};

const statuses = ["", "DRAFTED", "SENT", "VIEWED", "COMMENTED", "SIGNED", "PAID", "EXPIRED", "VOID"];

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [templateIdForCreate, setTemplateIdForCreate] = useState("");
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  async function loadDocuments(search = query, statusFilter = status) {
    setError("");
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (search.trim()) {
      params.set("q", search.trim());
    }
    if (statusFilter) {
      params.set("status", statusFilter);
    }
    const response = await fetch(`/api/documents?${params.toString()}`);
    if (!response.ok) {
      setError("Failed to load documents");
      return;
    }
    const payload = (await response.json()) as { documents: DocumentItem[] };
    setDocuments(payload.documents);
  }

  async function loadTemplates() {
    const response = await fetch("/api/templates?limit=100");
    if (!response.ok) {
      return;
    }
    const payload = (await response.json()) as { templates: TemplateOption[] };
    setTemplates(payload.templates);
    setTemplateIdForCreate((current) => current || payload.templates[0]?.id || "");
  }

  async function createBlankDocument() {
    setError("");
    setStatusMessage("");
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!response.ok) {
      setError("Failed to create blank document");
      return;
    }
    setStatusMessage("Blank document created.");
    await loadDocuments();
  }

  async function createFromTemplate() {
    if (!templateIdForCreate) {
      return;
    }
    setError("");
    setStatusMessage("");
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: templateIdForCreate }),
    });
    if (!response.ok) {
      setError("Failed to create document from template");
      return;
    }
    setStatusMessage("Document created from template.");
    await loadDocuments();
  }

  useEffect(() => {
    void loadDocuments();
    void loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="text-sm text-muted">Search, filter, and create documents from blank or templates.</p>
      </div>

      <div className="grid gap-2 rounded-xl border border-border bg-surface p-3 md:grid-cols-[1fr_220px_auto]">
        <input
          className="rounded border border-border bg-background px-3 py-2 text-sm"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by document or template ID"
        />
        <select
          className="rounded border border-border bg-background px-3 py-2 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {statuses.map((item) => (
            <option key={item || "ALL"} value={item}>
              {item || "All statuses"}
            </option>
          ))}
        </select>
        <button
          onClick={() => void loadDocuments()}
          className="rounded border border-border px-3 py-2 text-sm hover:bg-background"
        >
          Search
        </button>
      </div>

      <div className="grid gap-2 rounded-xl border border-border bg-surface p-3 md:grid-cols-[auto_1fr_auto_auto]">
        <span className="self-center text-sm text-muted">New document</span>
        <select
          className="rounded border border-border bg-background px-3 py-2 text-sm"
          value={templateIdForCreate}
          onChange={(event) => setTemplateIdForCreate(event.target.value)}
        >
          <option value="">Select template (optional)</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => void createFromTemplate()}
          className="rounded border border-border px-3 py-2 text-sm hover:bg-background"
        >
          Create from template
        </button>
        <button
          onClick={() => void createBlankDocument()}
          className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground"
        >
          Create blank
        </button>
      </div>

      {statusMessage ? <p className="text-sm text-green-600">{statusMessage}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="space-y-2">
        {documents.map((document) => (
          <Link
            key={document.id}
            href={`/app/documents/${document.id}`}
            className="block rounded-xl border border-border bg-surface p-3 text-sm hover:bg-background"
          >
            <p className="font-medium">{document.id}</p>
            <p className="text-xs text-muted">
              Status: {document.status} | Template: {document.template_id ?? "blank"}
            </p>
            <p className="text-xs text-muted">
              Updated: {new Date(document.updated_at).toLocaleString()} | Created:{" "}
              {new Date(document.created_at).toLocaleString()}
            </p>
          </Link>
        ))}
        {documents.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            No documents found.
          </div>
        ) : null}
      </section>
    </main>
  );
}
