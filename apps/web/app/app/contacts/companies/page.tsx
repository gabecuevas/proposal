"use client";

import { useCallback, useEffect, useState } from "react";
import { CompanyVariableHint, crmInputClass } from "@/components/crm/variable-pills";
import { formatRelativeContact } from "@/lib/ui/time";

type Company = {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  industry: string | null;
  city: string | null;
  people_count: number;
  updated_at: string;
};

type Editor = {
  name: string;
  website: string;
  phone: string;
  email: string;
  industry: string;
  city: string;
  notes: string;
};

const emptyEditor = (): Editor => ({
  name: "",
  website: "",
  phone: "",
  email: "",
  industry: "",
  city: "",
  notes: "",
});

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editor, setEditor] = useState<Editor>(emptyEditor);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setError("");
    const params = new URLSearchParams({ limit: "200" });
    if (query.trim()) {
      params.set("q", query.trim());
    }
    const response = await fetch(`/api/companies?${params.toString()}`);
    if (!response.ok) {
      setError("Failed to load companies");
      return;
    }
    const payload = (await response.json()) as { companies: Company[] };
    setCompanies(payload.companies);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setError("");
    setStatus("");
    const body = {
      name: editor.name,
      website: editor.website || undefined,
      phone: editor.phone || undefined,
      email: editor.email || undefined,
      industry: editor.industry || undefined,
      city: editor.city || undefined,
      notes: editor.notes || undefined,
    };
    const response = selectedId
      ? await fetch(`/api/companies/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
    if (!response.ok) {
      setError(selectedId ? "Failed to save company" : "Failed to create company");
      return;
    }
    setStatus(selectedId ? "Company saved." : "Company created.");
    setShowForm(false);
    await load();
  }

  const selected = companies.find((company) => company.id === selectedId);

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Companies</h1>
          <p className="mt-1 text-sm text-muted">
            Linked documents can fill <code className="text-foreground">[Company.Name]</code> and related tokens.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelectedId("");
            setEditor(emptyEditor());
            setShowForm(true);
          }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-95"
        >
          + Add company
        </button>
      </div>

      <input
        className={`h-10 w-full max-w-xl ${crmInputClass()}`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && void load()}
        placeholder="Search companies…"
      />

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Industry</th>
              <th className="px-4 py-3">People</th>
              <th className="px-4 py-3">Website</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {companies.map((company) => (
              <tr
                key={company.id}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-slate-50/60"
                onClick={() => {
                  setSelectedId(company.id);
                  setEditor({
                    name: company.name,
                    website: company.website ?? "",
                    phone: company.phone ?? "",
                    email: company.email ?? "",
                    industry: company.industry ?? "",
                    city: company.city ?? "",
                    notes: "",
                  });
                  setShowForm(true);
                }}
              >
                <td className="px-4 py-3 font-medium text-foreground">{company.name}</td>
                <td className="px-4 py-3 text-muted">{company.industry ?? "—"}</td>
                <td className="px-4 py-3 tabular-nums text-muted">{company.people_count}</td>
                <td className="px-4 py-3 text-muted">{company.website ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{formatRelativeContact(company.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {companies.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted">No companies yet.</p>
        ) : null}
      </div>

      {showForm ? (
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{selected ? "Edit company" : "New company"}</h2>
          <div className="mt-3">
            <CompanyVariableHint />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              className={`${crmInputClass()} md:col-span-2`}
              value={editor.name}
              onChange={(event) => setEditor((current) => ({ ...current, name: event.target.value }))}
              placeholder="Company name"
            />
            <input
              className={crmInputClass()}
              value={editor.website}
              onChange={(event) => setEditor((current) => ({ ...current, website: event.target.value }))}
              placeholder="Website"
            />
            <input
              className={crmInputClass()}
              value={editor.industry}
              onChange={(event) => setEditor((current) => ({ ...current, industry: event.target.value }))}
              placeholder="Industry"
            />
            <input
              className={crmInputClass()}
              value={editor.email}
              onChange={(event) => setEditor((current) => ({ ...current, email: event.target.value }))}
              placeholder="Email"
            />
            <input
              className={crmInputClass()}
              value={editor.phone}
              onChange={(event) => setEditor((current) => ({ ...current, phone: event.target.value }))}
              placeholder="Phone"
            />
            <input
              className={`${crmInputClass()} md:col-span-2`}
              value={editor.city}
              onChange={(event) => setEditor((current) => ({ ...current, city: event.target.value }))}
              placeholder="City"
            />
            <textarea
              className={`min-h-[80px] ${crmInputClass()} md:col-span-2`}
              value={editor.notes}
              onChange={(event) => setEditor((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Notes"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
            >
              {selected ? "Save company" : "Create company"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-background"
            >
              Close
            </button>
          </div>
          {status ? <p className="mt-3 text-sm text-emerald-700">{status}</p> : null}
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
        </section>
      ) : null}
    </div>
  );
}
