"use client";

import { useState } from "react";
import type { EditorDoc } from "@/lib/editor/types";
import { documentTitleFromEditorJson } from "@/lib/ui/document-title";

type ExportDocument = {
  id: string;
  status: string;
  editor_json: EditorDoc;
  created_at: string;
  updated_at: string;
};

function toCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export default function DataExportPage() {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function exportDocuments() {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/documents?limit=1000");
      if (!response.ok) {
        setStatus("Failed to load documents for export.");
        return;
      }
      const payload = (await response.json()) as { documents: ExportDocument[] };
      const rows = [
        ["Document ID", "Title", "Status", "Created", "Last Updated"],
        ...payload.documents.map((document) => [
          document.id,
          documentTitleFromEditorJson(document.editor_json, document.id),
          document.status,
          new Date(document.created_at).toISOString(),
          new Date(document.updated_at).toISOString(),
        ]),
      ];

      const csv = rows.map((row) => row.map(toCsvCell).join(",")).join("\n");
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `documents-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      setStatus(`Exported ${payload.documents.length} documents.`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-surface">
        <header className="border-b border-border bg-slate-50/80 px-4 py-2 text-center text-sm font-medium text-foreground">
          Data Export
        </header>
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted">
            Download every document in this workspace as a CSV, including status and lifecycle
            timestamps.
          </p>
          <button
            type="button"
            onClick={() => void exportDocuments()}
            disabled={busy}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-60"
          >
            {busy ? "Preparing export…" : "Export documents (CSV)"}
          </button>
          {status ? <p className="text-sm text-muted">{status}</p> : null}
        </div>
      </section>
    </div>
  );
}
