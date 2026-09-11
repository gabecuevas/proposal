"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@repo/ui/utils";
import type { CrmEmailTemplateDto } from "@/lib/crm/email-templates";

type CrmEmailTemplateManageModalProps = {
  open: boolean;
  templates: CrmEmailTemplateDto[];
  onClose: () => void;
  onAddNew: () => void;
  onEdit: (template: CrmEmailTemplateDto) => void;
  onDeleted: (templateId: string) => void;
  onRefresh?: () => void;
};

function LockIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-slate-600" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="6" y="11" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 11V8.5a3.5 3.5 0 017 0V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function formatCreatedTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function CrmEmailTemplateManageModal({
  open,
  templates,
  onClose,
  onAddNew,
  onEdit,
  onDeleted,
}: CrmEmailTemplateManageModalProps) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setSelectedIds(new Set());
    setError(null);
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return templates;
    }
    return templates.filter(
      (item) =>
        item.name.toLowerCase().includes(q) || item.subject.toLowerCase().includes(q),
    );
  }, [templates, query]);

  if (!open || !mounted) {
    return null;
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function deleteTemplate(template: CrmEmailTemplateDto) {
    if (!window.confirm(`Delete “${template.name}”?`)) {
      return;
    }
    setBusyId(template.id);
    setError(null);
    try {
      const response = await fetch(`/api/crm/email-templates/${template.id}`, { method: "DELETE" });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Could not delete template.");
      }
      onDeleted(template.id);
      setSelectedIds((current) => {
        const next = new Set(current);
        next.delete(template.id);
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete template.");
    } finally {
      setBusyId(null);
    }
  }

  return createPortal(
    <div className="app-theme fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-900/30" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-email-templates-title"
        className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="manage-email-templates-title" className="text-base font-semibold text-foreground">
            Manage email templates
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-muted hover:bg-slate-50 hover:text-foreground"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <label className="flex items-center gap-2 rounded-md border border-border bg-white px-2.5 py-2">
            <svg className="h-3.5 w-3.5 text-muted" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search templates"
              className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </label>

          <button
            type="button"
            onClick={onAddNew}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add new template
          </button>

          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No email templates yet.</p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-md border border-border">
              {filtered.map((template) => {
                const selected = selectedIds.has(template.id);
                return (
                  <li
                    key={template.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2.5 hover:bg-slate-50",
                      selected && "bg-slate-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSelected(template.id)}
                      className="h-4 w-4 accent-[var(--primary)]"
                      aria-label={`Select ${template.name}`}
                    />
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      onClick={() => onEdit(template)}
                    >
                      {template.visibility === "PRIVATE" ? <LockIcon /> : <span className="w-3.5" />}
                      <span className="truncate text-sm font-medium text-foreground">{template.name}</span>
                    </button>
                    <span className="hidden shrink-0 text-xs text-muted sm:inline">
                      {formatCreatedTime(template.createdAt)}
                    </span>
                    <button
                      type="button"
                      title="Delete template"
                      disabled={busyId === template.id}
                      onClick={() => void deleteTemplate(template)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden>
                        <path
                          d="M5 7h14M10 7V5h4v2M9 7v12m6-12v12M8 19h8"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                    <span
                      className="inline-flex h-8 w-8 cursor-grab items-center justify-center text-muted"
                      title="Drag to reorder"
                      aria-hidden
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="9" cy="7" r="1.2" />
                        <circle cx="15" cy="7" r="1.2" />
                        <circle cx="9" cy="12" r="1.2" />
                        <circle cx="15" cy="12" r="1.2" />
                        <circle cx="9" cy="17" r="1.2" />
                        <circle cx="15" cy="17" r="1.2" />
                      </svg>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <div className="flex items-center justify-start border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
