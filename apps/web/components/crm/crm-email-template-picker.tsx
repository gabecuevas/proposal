"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@repo/ui/utils";
import type { CrmEmailTemplateDto } from "@/lib/crm/email-templates";

type CrmEmailTemplatePickerProps = {
  templates: CrmEmailTemplateDto[];
  onSelect: (template: CrmEmailTemplateDto) => void;
  onSaveDraftAsTemplate: () => void;
  onManageTemplates: () => void;
  onSearch?: (query: string) => void;
  className?: string;
};

function LockIcon() {
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-slate-600" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="6" y="11" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.5 11V8.5a3.5 3.5 0 017 0V11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-muted" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CrmEmailTemplatePicker({
  templates,
  onSelect,
  onSaveDraftAsTemplate,
  onManageTemplates,
  onSearch,
  className,
}: CrmEmailTemplatePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    onSearch?.(query);
  }, [query, onSearch]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (item) =>
        item.name.toLowerCase().includes(q) || item.subject.toLowerCase().includes(q),
    );
  }, [templates, query]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md py-1 pl-1.5 pr-1 text-sm font-semibold text-foreground",
          "hover:bg-slate-100/80",
          open && "bg-slate-100/80",
        )}
      >
        Choose template
        <ChevronIcon />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 overflow-hidden rounded-lg border border-border bg-white shadow-lg">
          <div className="p-2">
            <label className="flex items-center gap-2 rounded-full border border-sky-400 bg-white px-2.5 py-1.5">
              <svg className="h-3.5 w-3.5 text-muted" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted"
              />
            </label>
          </div>

          <ul className="max-h-56 overflow-y-auto px-1 pb-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted">No email templates yet.</li>
            ) : (
              filtered.map((template) => (
                <li key={template.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-foreground hover:bg-slate-50"
                    onClick={() => {
                      onSelect(template);
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    {template.visibility === "PRIVATE" ? <LockIcon /> : <span className="w-3.5" />}
                    <span className="truncate">{template.name}</span>
                  </button>
                </li>
              ))
            )}
          </ul>

          <div className="border-t border-border py-1">
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                onSaveDraftAsTemplate();
              }}
            >
              <span className="text-sky-600">+</span>
              <span>Save draft as a template...</span>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-slate-50"
              onClick={() => {
                setOpen(false);
                onManageTemplates();
              }}
            >
              <svg className="h-3.5 w-3.5 text-sky-600" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M4 17.5l9.2-9.2 3.5 3.5L7.5 21H4v-3.5zM14.7 6.8l1.7-1.7a1.5 1.5 0 012.1 0l1.4 1.4a1.5 1.5 0 010 2.1l-1.7 1.7-3.5-3.5z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
              <span>Manage templates</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
