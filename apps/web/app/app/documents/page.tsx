"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ConfirmStatusChangeModal,
} from "@/components/documents/document-status-modals";
import {
  DocumentsViewActionsBar,
  type DocumentStatusChangeTarget,
} from "@/components/documents/documents-view-actions-bar";
import { ConfirmDeleteModal, PromptNameModal } from "@/components/templates/library-modals";
import {
  ResizableSheetTh,
  SheetPage,
  SheetTable,
  sheetTd,
  sheetTh,
  sheetTr,
} from "@/components/ui/sheet-table";
import { useResizableColumns, type ResizableColumnDef } from "@/components/ui/use-resizable-columns";
import type { EditorDoc } from "@/lib/editor/types";
import { applyTitleToDoc, documentDueDateFromEditorJson, documentSenderFromEditorJson, documentTitleFromEditorJson } from "@/lib/ui/document-title";
import {
  documentStatusDisplayLabel,
  matchesDocumentTab,
  toDocumentTrackingTab,
} from "@/lib/ui/document-tracking";
import { formatRelativeTime, formatShortDate } from "@/lib/ui/time";

type Recipient = {
  id: string;
  email: string;
  name: string;
  role: string;
  company_name?: string | null;
  contact_id?: string | null;
};

type DocumentItem = {
  id: string;
  status: string;
  template_id: string | null;
  editor_json: EditorDoc;
  recipients_json: Recipient[];
  created_at: string;
  updated_at: string;
};

type ModalKind = "rename" | "delete" | "status" | null;

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
  if (s === "TRASHED") {
    return `${base} bg-slate-200 text-slate-700`;
  }
  return `${base} bg-slate-100 text-slate-600`;
}

function firstRecipient(recipients: Recipient[]): {
  name: string;
  email: string;
  company: string;
} {
  const r = recipients[0];
  if (!r) {
    return { name: "—", email: "—", company: "—" };
  }
  return {
    name: r.name?.trim() || "—",
    email: r.email?.trim() || "—",
    company: r.company_name?.trim() || "—",
  };
}

function hasRecipients(document: DocumentItem): boolean {
  return Array.isArray(document.recipients_json) && document.recipients_json.length > 0;
}

const DOCUMENT_TABLE_COLUMNS: ResizableColumnDef[] = [
  { id: "select", defaultWidth: 40 },
  { id: "title", defaultWidth: 200 },
  { id: "company", defaultWidth: 150 },
  { id: "name", defaultWidth: 150 },
  { id: "email", defaultWidth: 180 },
  { id: "status", defaultWidth: 100 },
  { id: "created", defaultWidth: 120 },
  { id: "sender", defaultWidth: 130 },
  { id: "due", defaultWidth: 120 },
  { id: "updated", defaultWidth: 110 },
  { id: "actions", defaultWidth: 44 },
];

export default function DocumentsPage() {
  const searchParams = useSearchParams();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [actionHint, setActionHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalKind>(null);
  const [statusTarget, setStatusTarget] = useState<DocumentStatusChangeTarget | null>(null);
  const [renameTarget, setRenameTarget] = useState<DocumentItem | null>(null);
  const { widthFor, tableMinWidth, beginResize, onResizeMove, endResize } = useResizableColumns(
    "documents-table-v1",
    DOCUMENT_TABLE_COLUMNS,
  );

  const activeTab = toDocumentTrackingTab(searchParams.get("tab"));
  const isDraftTab = activeTab === "draft";

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

  useEffect(() => {
    setSelectionMode(false);
    setSelected(new Set());
    setActionHint("");
    setModal(null);
    setStatusTarget(null);
    setRenameTarget(null);
  }, [activeTab]);

  const filtered = useMemo(() => {
    return documents.filter((d) => {
      if (!matchesDocumentTab(activeTab, d.status)) {
        return false;
      }
      // Drafts are documents started in + New Document with at least one recipient.
      if (activeTab === "draft" && !hasRecipients(d)) {
        return false;
      }
      return true;
    });
  }, [documents, activeTab]);

  const selectedItems = useMemo(
    () => filtered.filter((item) => selected.has(item.id)),
    [filtered, selected],
  );

  function ensureSelectionMode() {
    setSelectionMode(true);
    setActionHint("");
  }

  function requireSelection(min = 1, max?: number): DocumentItem[] | null {
    if (selectedItems.length < min) {
      setActionHint(
        min === 1 ? "Select at least one document first." : `Select at least ${min} documents first.`,
      );
      return null;
    }
    if (typeof max === "number" && selectedItems.length > max) {
      setActionHint(max === 1 ? "Select only one document for this action." : `Select at most ${max} documents.`);
      return null;
    }
    setActionHint("");
    return selectedItems;
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function toggleSelectAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(filtered.map((item) => item.id)));
  }

  async function renameSelected(name: string) {
    const items = requireSelection(1, 1);
    if (!items) {
      return;
    }
    const target = items[0]!;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/documents/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          editor_json: applyTitleToDoc(target.editor_json, name),
        }),
      });
      if (!response.ok) {
        throw new Error("Could not rename document");
      }
      setModal(null);
      setRenameTarget(null);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename document");
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    const items = requireSelection(1);
    if (!items) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const item of items) {
        const response = await fetch(`/api/documents/${item.id}`, { method: "DELETE" });
        if (!response.ok) {
          throw new Error("Could not delete document");
        }
      }
      setModal(null);
      setSelected(new Set());
      setSelectionMode(false);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete document");
    } finally {
      setBusy(false);
    }
  }

  async function applyStatusChange() {
    const items = requireSelection(1);
    if (!items || !statusTarget) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      for (const item of items) {
        const response = await fetch(`/api/documents/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: statusTarget.status }),
        });
        if (!response.ok) {
          throw new Error("Could not change status");
        }
      }
      setModal(null);
      setStatusTarget(null);
      setSelected(new Set());
      setSelectionMode(false);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change status");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SheetPage
      error={error || actionHint}
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
              className="h-8 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none ring-primary/15 focus:ring-2"
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
            className="inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-foreground hover:bg-slate-50"
          >
            Filter
          </button>
        </>
      }
    >
      {isDraftTab ? (
        <DocumentsViewActionsBar
          selectionMode={selectionMode}
          selectionCount={selected.size}
          menuHint={
            selectionMode && selected.size === 0
              ? "Select items below, then choose an action."
              : undefined
          }
          onActionsOpen={ensureSelectionMode}
          onClearSelection={() => {
            setSelectionMode(false);
            setSelected(new Set());
            setActionHint("");
          }}
          onChangeStatus={(target) => {
            if (!requireSelection(1)) {
              return;
            }
            setStatusTarget(target);
            setModal("status");
          }}
          onRename={() => {
            const items = requireSelection(1, 1);
            if (!items) {
              return;
            }
            setRenameTarget(items[0]!);
            setModal("rename");
          }}
          onDelete={() => {
            if (!requireSelection(1)) {
              return;
            }
            setModal("delete");
          }}
        />
      ) : null}

      <SheetTable
        minWidth={tableMinWidth + (isDraftTab && selectionMode ? 0 : -widthFor("select"))}
        empty={
          filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted">No documents in this view.</p>
          ) : null
        }
      >
        <thead>
          <tr>
            {isDraftTab && selectionMode ? (
              <th
                className={sheetTh("w-10")}
                data-library-select
                style={{ width: widthFor("select"), minWidth: widthFor("select") }}
              >
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={filtered.length > 0 && selected.size === filtered.length}
                  onChange={toggleSelectAll}
                />
              </th>
            ) : null}
            <ResizableSheetTh
              width={widthFor("title")}
              onResizeStart={(event) => beginResize(event, "title")}
              onResizeMove={onResizeMove}
              onResizeEnd={endResize}
            >
              Document Title
            </ResizableSheetTh>
            <ResizableSheetTh
              width={widthFor("company")}
              onResizeStart={(event) => beginResize(event, "company")}
              onResizeMove={onResizeMove}
              onResizeEnd={endResize}
            >
              Recipient Company
            </ResizableSheetTh>
            <ResizableSheetTh
              width={widthFor("name")}
              onResizeStart={(event) => beginResize(event, "name")}
              onResizeMove={onResizeMove}
              onResizeEnd={endResize}
            >
              Recipient Name
            </ResizableSheetTh>
            <ResizableSheetTh
              width={widthFor("email")}
              onResizeStart={(event) => beginResize(event, "email")}
              onResizeMove={onResizeMove}
              onResizeEnd={endResize}
            >
              Recipient Email
            </ResizableSheetTh>
            <ResizableSheetTh
              width={widthFor("status")}
              onResizeStart={(event) => beginResize(event, "status")}
              onResizeMove={onResizeMove}
              onResizeEnd={endResize}
            >
              Status
            </ResizableSheetTh>
            <ResizableSheetTh
              width={widthFor("created")}
              onResizeStart={(event) => beginResize(event, "created")}
              onResizeMove={onResizeMove}
              onResizeEnd={endResize}
            >
              Created date
            </ResizableSheetTh>
            <ResizableSheetTh
              width={widthFor("sender")}
              onResizeStart={(event) => beginResize(event, "sender")}
              onResizeMove={onResizeMove}
              onResizeEnd={endResize}
            >
              Sender
            </ResizableSheetTh>
            <ResizableSheetTh
              width={widthFor("due")}
              onResizeStart={(event) => beginResize(event, "due")}
              onResizeMove={onResizeMove}
              onResizeEnd={endResize}
            >
              Due Date
            </ResizableSheetTh>
            <ResizableSheetTh
              width={widthFor("updated")}
              onResizeStart={(event) => beginResize(event, "updated")}
              onResizeMove={onResizeMove}
              onResizeEnd={endResize}
            >
              Updated
            </ResizableSheetTh>
            <th
              className={sheetTh("w-10")}
              aria-label="Actions"
              style={{ width: widthFor("actions"), minWidth: widthFor("actions") }}
            />
          </tr>
        </thead>
        <tbody>
          {filtered.map((document) => {
            const title = documentTitleFromEditorJson(document.editor_json, document.id);
            const recipient = firstRecipient(document.recipients_json);
            const sender = documentSenderFromEditorJson(document.editor_json) || "—";
            const dueDate = documentDueDateFromEditorJson(document.editor_json);
            const checked = selected.has(document.id);
            return (
              <tr key={document.id} className={sheetTr()}>
                {isDraftTab && selectionMode ? (
                  <td
                    className={sheetTd("w-10")}
                    data-library-select
                    style={{ width: widthFor("select"), minWidth: widthFor("select") }}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select ${title}`}
                      checked={checked}
                      onChange={() => toggleSelected(document.id)}
                    />
                  </td>
                ) : null}
                <td className={sheetTd()} style={{ width: widthFor("title"), maxWidth: widthFor("title") }}>
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
                    <span className="truncate" title={title}>
                      {title}
                    </span>
                  </Link>
                </td>
                <td
                  className={sheetTd("truncate text-foreground")}
                  style={{ width: widthFor("company"), maxWidth: widthFor("company") }}
                  title={recipient.company}
                >
                  {recipient.company}
                </td>
                <td
                  className={sheetTd("truncate text-foreground")}
                  style={{ width: widthFor("name"), maxWidth: widthFor("name") }}
                  title={recipient.name}
                >
                  {recipient.name}
                </td>
                <td
                  className={sheetTd("truncate")}
                  style={{ width: widthFor("email"), maxWidth: widthFor("email") }}
                  title={recipient.email}
                >
                  {recipient.email}
                </td>
                <td
                  className={sheetTd("whitespace-nowrap")}
                  style={{ width: widthFor("status"), maxWidth: widthFor("status") }}
                >
                  <span className={statusBadgeClass(document.status)}>
                    {documentStatusDisplayLabel(document.status)}
                  </span>
                </td>
                <td
                  className={sheetTd("whitespace-nowrap")}
                  style={{ width: widthFor("created"), maxWidth: widthFor("created") }}
                >
                  {formatShortDate(document.created_at)}
                </td>
                <td
                  className={sheetTd("truncate text-foreground")}
                  style={{ width: widthFor("sender"), maxWidth: widthFor("sender") }}
                  title={sender}
                >
                  {sender}
                </td>
                <td
                  className={sheetTd("whitespace-nowrap")}
                  style={{ width: widthFor("due"), maxWidth: widthFor("due") }}
                >
                  {formatShortDate(dueDate)}
                </td>
                <td
                  className={sheetTd("whitespace-nowrap")}
                  style={{ width: widthFor("updated"), maxWidth: widthFor("updated") }}
                >
                  {formatRelativeTime(document.updated_at)}
                </td>
                <td
                  className={sheetTd("w-10 text-center")}
                  style={{ width: widthFor("actions"), minWidth: widthFor("actions") }}
                >
                  <Link href={`/app/documents/${document.id}`} className="inline-block p-1 hover:text-foreground">
                    ···
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </SheetTable>

      <PromptNameModal
        open={modal === "rename" && Boolean(renameTarget)}
        title="Rename document"
        label="Document title"
        initialValue={
          renameTarget ? documentTitleFromEditorJson(renameTarget.editor_json, renameTarget.id) : ""
        }
        confirmLabel="Rename"
        busy={busy}
        onClose={() => {
          setModal(null);
          setRenameTarget(null);
        }}
        onConfirm={(value) => void renameSelected(value)}
      />
      <ConfirmDeleteModal
        open={modal === "delete"}
        count={selectedItems.length}
        busy={busy}
        noun="document"
        onClose={() => setModal(null)}
        onConfirm={() => void deleteSelected()}
      />
      <ConfirmStatusChangeModal
        open={modal === "status" && Boolean(statusTarget)}
        statusLabel={statusTarget?.label ?? ""}
        count={selectedItems.length}
        busy={busy}
        onClose={() => {
          setModal(null);
          setStatusTarget(null);
        }}
        onConfirm={() => void applyStatusChange()}
      />
    </SheetPage>
  );
}
