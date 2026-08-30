"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { EditorDoc } from "@/lib/editor/types";
import { documentTitleFromEditorJson } from "@/lib/ui/document-title";
import {
  documentStatusDisplayLabel,
  matchesDocumentTab,
  toDocumentTrackingTab,
} from "@/lib/ui/document-tracking";
import { SheetPage, SheetTable, sheetTd, sheetTh, sheetTr } from "@/components/ui/sheet-table";
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
  if (s === "VOID") {
    return `${base} bg-red-100 text-red-800`;
  }
  if (s === "EXPIRED") {
    return `${base} bg-amber-100 text-amber-800`;
  }
  return `${base} bg-slate-100 text-slate-600`;
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

  const activeTab = toDocumentTrackingTab(searchParams.get("tab"));

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
    () => documents.filter((d) => matchesDocumentTab(activeTab, d.status)),
    [documents, activeTab],
  );

  return (
    <SheetPage
      error={error}
      toolbar={
        <>
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
          <p className="text-sm text-muted">
            {filtered.length} {filtered.length === 1 ? "document" : "documents"}
          </p>
          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-foreground hover:bg-slate-50"
          >
            Filter
          </button>
        </>
      }
    >
      <SheetTable
        minWidth="40rem"
        empty={
          filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">No documents in this view.</p>
          ) : null
        }
      >
        <thead>
          <tr>
            <th className={sheetTh()}>Document</th>
            <th className={sheetTh("hidden sm:table-cell")}>Recipient</th>
            <th className={sheetTh()}>Status</th>
            <th className={sheetTh()}>Updated</th>
            <th className={sheetTh("w-10")} aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {filtered.map((document) => {
            const title = documentTitleFromEditorJson(document.editor_json, document.id);
            return (
              <tr key={document.id} className={sheetTr()}>
                <td className={sheetTd("min-w-0")}>
                  <Link
                    href={`/app/documents/${document.id}`}
                    className="flex min-w-0 items-center gap-2 font-medium text-primary"
                  >
                    <span className="shrink-0 text-muted" aria-hidden>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M8 4h8l4 4v12a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                      </svg>
                    </span>
                    <span className="truncate">{title}</span>
                  </Link>
                </td>
                <td className={sheetTd("hidden max-w-[16rem] truncate sm:table-cell")}>
                  {firstRecipientEmail(document.recipients_json)}
                </td>
                <td className={sheetTd("whitespace-nowrap")}>
                  <span className={statusBadgeClass(document.status)}>
                    {documentStatusDisplayLabel(document.status)}
                  </span>
                </td>
                <td className={sheetTd("whitespace-nowrap")}>{formatRelativeTime(document.updated_at)}</td>
                <td className={sheetTd("text-center")}>
                  <Link href={`/app/documents/${document.id}`} className="inline-block p-1 hover:text-foreground">
                    ···
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </SheetTable>
    </SheetPage>
  );
}
