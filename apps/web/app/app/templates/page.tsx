"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import type { EditorDoc } from "@/lib/editor/types";
import {
  pageCountFromEditor,
  templateCategoryTabs,
  templateMatchesCategory,
  templateSubtitleFromTags,
  type TemplateCategoryId,
} from "@/lib/ui/template-meta";

const FAVORITES_KEY = "doxysign-template-favorites";

type TemplateItem = {
  id: string;
  name: string;
  tags: string[];
  editor_json: EditorDoc;
  created_at: string;
};

function loadFavoriteSet(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function persistFavoriteSet(set: Set<string>) {
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]));
}

export default function AppTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TemplateCategoryId>("all");
  const [error, setError] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    setFavorites(loadFavoriteSet());
  }, []);

  const loadTemplates = useCallback(async () => {
    setError("");
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (query.trim()) {
      params.set("q", query.trim());
    }
    const response = await fetch(`/api/templates?${params.toString()}`);
    if (!response.ok) {
      setError("Failed to load templates");
      return;
    }
    const payload = (await response.json()) as { templates: TemplateItem[] };
    setTemplates(payload.templates);
  }, [query]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const filtered = useMemo(() => {
    return templates.filter((t) => templateMatchesCategory(t.tags, category));
  }, [templates, category]);

  const tabs = templateCategoryTabs();

  function toggleFavorite(id: string, event: MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      persistFavoriteSet(next);
      return next;
    });
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-app-serif text-3xl font-normal tracking-tight text-foreground md:text-4xl">
          Templates
        </h1>
        <Link
          href="/app/templates/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
        >
          + Create template
        </Link>
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
          onKeyDown={(e) => e.key === "Enter" && void loadTemplates()}
          placeholder="Search templates…"
        />
      </div>

      <div className="flex flex-wrap gap-1 border-b border-border">
        {tabs.map((tab) => {
          const active = category === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategory(tab.id)}
              className={`relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filtered.map((template) => {
          const pages = pageCountFromEditor(template.editor_json);
          const starred = favorites.has(template.id);
          const subtitle = templateSubtitleFromTags(template.tags);
          return (
            <Link
              key={template.id}
              href={`/app/templates/${template.id}`}
              className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative flex aspect-[4/5] items-center justify-center bg-slate-100">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-slate-400" aria-hidden>
                  <path
                    d="M8 4h8l4 4v12a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  />
                </svg>
                <span className="absolute bottom-2 right-2 text-xs text-muted">{pages} pages</span>
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(template.id, e)}
                  className="absolute right-2 top-2 rounded p-1 text-amber-500 hover:bg-white/80"
                  aria-label={starred ? "Remove from favorites" : "Add to favorites"}
                >
                  {starred ? "★" : "☆"}
                </button>
              </div>
              <div className="border-t border-border p-3">
                <p className="font-semibold text-foreground">{template.name}</p>
                <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
              </div>
            </Link>
          );
        })}
      </section>
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted">No templates in this category.</p>
      ) : null}
    </main>
  );
}
