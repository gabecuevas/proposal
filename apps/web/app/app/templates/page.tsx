"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type TemplateItem = {
  id: string;
  name: string;
  tags: string[];
  created_at: string;
};

export default function AppTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [error, setError] = useState("");

  async function loadTemplates(search = query, tag = tagFilter) {
    setError("");
    const params = new URLSearchParams();
    params.set("limit", "100");
    if (search.trim()) {
      params.set("q", search.trim());
    }
    if (tag.trim()) {
      params.set("tag", tag.trim());
    }
    const response = await fetch(`/api/templates?${params.toString()}`);
    if (!response.ok) {
      setError("Failed to load templates");
      return;
    }
    const payload = (await response.json()) as { templates: TemplateItem[] };
    setTemplates(payload.templates);
  }

  useEffect(() => {
    void loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const template of templates) {
      for (const tag of template.tags) {
        set.add(tag);
      }
    }
    return [...set].sort();
  }, [templates]);

  return (
    <main className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Templates</h1>
          <p className="text-sm text-muted">Browse and reuse workspace templates.</p>
        </div>
        <Link
          href="/app/templates/new"
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          New template
        </Link>
      </div>

      <div className="grid gap-2 rounded-xl border border-border bg-surface p-3 md:grid-cols-[1fr_220px_auto]">
        <input
          className="rounded border border-border bg-background px-3 py-2 text-sm"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search templates by name"
        />
        <select
          className="rounded border border-border bg-background px-3 py-2 text-sm"
          value={tagFilter}
          onChange={(event) => setTagFilter(event.target.value)}
        >
          <option value="">All tags</option>
          {availableTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <button
          onClick={() => void loadTemplates()}
          className="rounded border border-border px-3 py-2 text-sm hover:bg-background"
        >
          Search
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <Link
            key={template.id}
            href={`/app/templates/${template.id}`}
            className="rounded-xl border border-border bg-surface p-4 hover:bg-background"
          >
            <p className="font-medium">{template.name}</p>
            <p className="mt-1 text-xs text-muted">{new Date(template.created_at).toLocaleString()}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {template.tags.map((tag) => (
                <span key={tag} className="rounded border border-border px-2 py-0.5 text-[11px] text-muted">
                  {tag}
                </span>
              ))}
            </div>
          </Link>
        ))}
        {templates.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
            No templates found.
          </div>
        ) : null}
      </section>
    </main>
  );
}
