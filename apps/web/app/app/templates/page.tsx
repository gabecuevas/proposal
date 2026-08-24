"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { UploadDropzone } from "@/components/templates/upload-dropzone";
import type { EditorDoc } from "@/lib/editor/types";
import { assetUrl } from "@/lib/storage/asset-url";
import {
  pageCountFromEditor,
  templateSubtitleFromTags,
  templateThumbnailKey,
} from "@/lib/ui/template-meta";

const FAVORITES_KEY = "doxysign-template-favorites";
const SUGGESTED_LIMIT = 8;

type TemplateItem = {
  id: string;
  name: string;
  tags: string[];
  editor_json: EditorDoc;
  created_at: string;
};

const TABS = [
  { id: "suggested", label: "Suggested" },
  { id: "mine", label: "My templates" },
  { id: "uploads", label: "Uploads" },
] as const;

type TabId = (typeof TABS)[number]["id"];

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
  const [tab, setTab] = useState<TabId>("suggested");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
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
      setLoading(false);
      return;
    }
    const payload = (await response.json()) as { templates: TemplateItem[] };
    setTemplates(payload.templates);
    setLoading(false);
  }, [query]);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const filtered = useMemo(() => {
    if (tab === "uploads") {
      return templates.filter((t) => t.tags.some((tag) => tag.toLowerCase() === "uploaded"));
    }
    if (tab === "suggested") {
      return templates.slice(0, SUGGESTED_LIMIT);
    }
    return templates;
  }, [templates, tab]);

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
    <main className="mx-auto max-w-6xl space-y-8">
      <h1 className="font-app-serif text-3xl font-normal tracking-tight text-foreground md:text-4xl">
        Templates
      </h1>

      <UploadDropzone onUploaded={() => void loadTemplates()} />

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">Start from a template</h2>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border">
          <div className="flex flex-wrap gap-1">
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`relative -mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted hover:text-foreground"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="relative mb-2 w-full max-w-xs">
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.5" />
                <path d="M16 16l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <input
              className="h-9 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm outline-none ring-primary/15 focus:ring-2"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search templates…"
              aria-label="Search templates"
            />
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Link
            href="/app/templates/new"
            className="group flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex aspect-[4/5] items-center justify-center bg-surface">
              <span className="text-3xl font-light text-muted transition-colors group-hover:text-primary">
                +
              </span>
            </div>
            <div className="border-t border-border p-3">
              <p className="font-semibold text-foreground">Blank document</p>
              <p className="mt-0.5 text-sm text-muted">Start from scratch</p>
            </div>
          </Link>

          {filtered.map((template) => {
            const pages = pageCountFromEditor(template.editor_json);
            const starred = favorites.has(template.id);
            const subtitle = templateSubtitleFromTags(template.tags);
            const thumbnailKey = templateThumbnailKey(template.editor_json);
            return (
              <Link
                key={template.id}
                href={`/app/templates/${template.id}`}
                className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="relative flex aspect-[4/5] items-center justify-center overflow-hidden bg-slate-100">
                  {thumbnailKey ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={assetUrl(thumbnailKey)}
                      alt=""
                      className="h-full w-full object-cover object-top"
                      loading="lazy"
                    />
                  ) : (
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-slate-400"
                      aria-hidden
                    >
                      <path
                        d="M8 4h8l4 4v12a1 1 0 01-1 1H8a1 1 0 01-1-1V5a1 1 0 011-1z"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                  )}
                  <span className="absolute bottom-2 right-2 rounded bg-white/85 px-1.5 py-0.5 text-xs text-muted">
                    {pages} {pages === 1 ? "page" : "pages"}
                  </span>
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
                  <p className="truncate font-semibold text-foreground">{template.name}</p>
                  <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
                </div>
              </Link>
            );
          })}
        </div>

        {!loading && filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {tab === "uploads"
              ? "No uploaded templates yet. Drop a PDF above to create one."
              : "No templates yet."}
          </p>
        ) : null}
      </section>
    </main>
  );
}
