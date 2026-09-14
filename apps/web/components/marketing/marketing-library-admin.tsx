"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  MARKETING_TEMPLATE_CATEGORIES,
  MARKETING_TEMPLATES,
  type MarketingTemplate,
} from "@/lib/marketing/template-library";

type SampleItem = {
  id: string;
  name: string;
  sample_folder_slug: string | null;
};

/**
 * Placeholder admin surface for the public SEO template library.
 * Only reachable for marketing library admins (see lib/marketing/admin.ts).
 */
export function MarketingLibraryAdminClient({ adminEmail }: { adminEmail: string }) {
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [selected, setSelected] = useState<MarketingTemplate | null>(MARKETING_TEMPLATES[0] ?? null);
  const [sampleId, setSampleId] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadSamples = useCallback(async () => {
    const response = await fetch("/api/templates/samples?limit=200");
    if (!response.ok) {
      setError("Could not load sample templates.");
      return;
    }
    const payload = (await response.json()) as {
      templates?: Array<{ id: string; name: string; sample_folder_slug?: string | null }>;
    };
    setSamples(
      (payload.templates ?? []).map((template) => ({
        id: template.id,
        name: template.name,
        sample_folder_slug: template.sample_folder_slug ?? null,
      })),
    );
  }, []);

  useEffect(() => {
    void loadSamples();
  }, [loadSamples]);

  async function saveLink() {
    if (!selected) {
      return;
    }
    setBusy(true);
    setError("");
    setStatus("");
    try {
      const response = await fetch("/api/marketing/template-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorySlug: selected.categorySlug,
          templateSlug: selected.slug,
          sampleTemplateId: sampleId || null,
          notes,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string; ok?: boolean };
      if (!response.ok) {
        throw new Error(payload.error || "Could not save link");
      }
      setStatus("Saved. Public page will use this Sample Template when preview wiring ships.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Marketing admin</p>
      <h1 className="mt-2 text-2xl font-semibold text-foreground">Public Document Templates</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">
        Signed in as <span className="font-medium text-foreground">{adminEmail}</span>. Map SEO library pages to in-app
        Sample Templates. Upload/edit masters still happens in Library → Sample Templates; this page stores the public
        link placeholder.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold">SEO page</p>
          <select
            className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            value={selected ? `${selected.categorySlug}/${selected.slug}` : ""}
            onChange={(event) => {
              const [categorySlug, templateSlug] = event.target.value.split("/");
              setSelected(
                MARKETING_TEMPLATES.find(
                  (template) => template.categorySlug === categorySlug && template.slug === templateSlug,
                ) ?? null,
              );
            }}
          >
            {MARKETING_TEMPLATE_CATEGORIES.map((category) => (
              <optgroup key={category.slug} label={category.name}>
                {MARKETING_TEMPLATES.filter((template) => template.categorySlug === category.slug).map((template) => (
                  <option key={template.slug} value={`${template.categorySlug}/${template.slug}`}>
                    {template.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {selected ? (
            <div className="mt-4 space-y-2 text-sm text-muted">
              <p>
                Public URL:{" "}
                <Link
                  href={`/templates/${selected.categorySlug}/${selected.slug}`}
                  className="font-medium text-primary hover:underline"
                  target="_blank"
                >
                  /templates/{selected.categorySlug}/{selected.slug}
                </Link>
              </p>
              <p>Primary keyword: {selected.primaryKeyword}</p>
              <p>Search volume: {selected.searchVolumeLabel}</p>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-surface p-4">
          <p className="text-sm font-semibold">Linked Sample Template</p>
          <select
            className="mt-2 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
            value={sampleId}
            onChange={(event) => setSampleId(event.target.value)}
          >
            <option value="">None yet (placeholder)</option>
            {samples.map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.name}
                {sample.sample_folder_slug ? ` · ${sample.sample_folder_slug}` : ""}
              </option>
            ))}
          </select>
          <label className="mt-4 block text-sm font-medium text-foreground">
            Notes
            <textarea
              className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2 text-sm"
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Upload status, legal review, SEO title overrides, etc."
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || !selected}
              onClick={() => void saveLink()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save link"}
            </button>
            <Link
              href="/app/templates"
              className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-slate-50"
            >
              Open Sample Templates
            </Link>
          </div>
          {status ? <p className="mt-3 text-sm text-emerald-700">{status}</p> : null}
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
