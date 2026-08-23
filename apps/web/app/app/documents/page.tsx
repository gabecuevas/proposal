"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EditorDoc } from "@/lib/editor/types";
import { documentTitleFromEditorJson } from "@/lib/ui/document-title";
import { formatRelativeTime } from "@/lib/ui/time";

type Recipient = { id: string; email: string; name: string; role: string };

type DocumentItem = {
  id: string;
  status: string;
  template_id: string | null;
  editor_json: EditorDoc;
  recipients_json: Recipient[];
  created_at: string;
  updated_at: string;
};

type TabKey = "all" | "draft" | "sent" | "viewed" | "completed" | "expired";

/** Keys mirror the Documents entries in the app shell sidebar. */
const tabMatchers: Record<TabKey, (status: string) => boolean> = {
  all: () => true,
  draft: (s) => s === "DRAFTED",
  sent: (s) => s === "SENT",
  viewed: (s) => s === "VIEWED" || s === "COMMENTED",
  completed: (s) => s === "SIGNED" || s === "PAID",
  expired: (s) => s === "EXPIRED" || s === "VOID",
};

function toTabKey(value: string | null): TabKey {
  return value && value in tabMatchers ? (value as TabKey) : "all";
}

function statusBadgeClass(status: string): string {
  const s = status.toUpperCase();
  const base = "inline-flex rounded-md px-2 py-0.5 text-xs font-medium";
  if (s === "DRAFTED") {
    return `${base} bg-slate-100 text-slate-700`;
  }
  if (s === "SENT") {
    return `${base} bg-sky-100 text-sky-800`;
  }
  if (s === "VIEWED" || s === "COMMENTED") {
    return `${base} bg-indigo-100 text-indigo-800`;
  }
  if (s === "SIGNED" || s === "PAID") {
    return `${base} bg-emerald-100 text-emerald-800`;
  }
  if (s === "EXPIRED" || s === "VOID") {
    return `${base} bg-red-100 text-red-800`;
  }
  return `${base} bg-slate-100 text-slate-600`;
}

function statusDisplayLabel(status: string): string {
  const s = status.toUpperCase();
  if (s === "DRAFTED") {
    return "Draft";
  }
  if (s === "SIGNED" || s === "PAID") {
    return "Completed";
  }
  if (s === "VOID") {
    return "Expired";
  }
  if (s === "COMMENTED") {
    return "Viewed";
  }
  return s.charAt(0) + s.slice(1).toLowerCase();
}

function firstRecipientEmail(recipients: Recipient[]): string {
  const r = recipients[0];
  return r?.email ?? "—";
}

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const activeTab = toTabKey(searchParams.get("tab"));

  const loadDocuments = useCallback(async () => {
    setError("");
    const params = new URLSearchParams();
    params.set("limit", "200");
    if (query.trim()) {
      params.set("q", query.trim());
    }
    const response = await fetch(`/api/documents?${params.toString()}`);
    if (!response.ok) {
      setError("Failed to load documents");
      return;
    }
    const payload = (await response.json()) as { documents: DocumentItem[] };
    setDocuments(payload.documents);
  }, [query]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const filtered = useMemo(
    () => documents.filter((d) => tabMatchers[activeTab](d.status.toUpperCase())),
    [documents, activeTab],
  );

  return (
    <main className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
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
            onKeyDown={(e) => e.key === "Enter" && void loadDocuments()}
            placeholder="Search documents…"
          />
        </div>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-foreground hover:bg-slate-50"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 6h16M7 12h10M10 18h4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          Filter
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Document</th>
              <th className="px-4 py-3">Recipient</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="w-10 px-2 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((document) => {
              const title = documentTitleFromEditorJson(document.editor_json, document.id);
              return (
                <tr key={document.id} className="border-b border-border last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/documents/${document.id}`}
                      className="flex items-center gap-2 font-medium text-foreground hover:text-primary"
                    >
                      <span className="text-muted" aria-hidden>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M8 4h8l4 4v12a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          />
                        </svg>
                      </span>
                      {title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{firstRecipientEmail(document.recipients_json)}</td>
                  <td className="px-4 py-3">
                    <span className={statusBadgeClass(document.status)}>
                      {statusDisplayLabel(document.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatRelativeTime(document.updated_at)}</td>
                  <td className="px-2 py-3 text-center text-muted">
                    <Link href={`/app/documents/${document.id}`} className="inline-block p-1 hover:text-foreground">
                      ···
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No documents in this view.</p>
        ) : null}
      </div>
    </main>
  );
}
