"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientVariableHint, crmInputClass } from "@/components/crm/variable-pills";
import { formatRelativeContact } from "@/lib/ui/time";

type Person = {
  id: string;
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  company_id: string | null;
  title: string | null;
  city: string | null;
  updated_at: string;
};

type CompanyOption = { id: string; name: string };

type Editor = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  title: string;
  company_id: string;
  company_name: string;
  city: string;
  notes: string;
};

const emptyEditor = (): Editor => ({
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  title: "",
  company_id: "",
  company_name: "",
  city: "",
  notes: "",
});

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
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
    const [peopleRes, companiesRes] = await Promise.all([
      fetch(`/api/contacts?${params.toString()}`),
      fetch("/api/companies?limit=200"),
    ]);
    if (!peopleRes.ok) {
      setError("Failed to load people");
      return;
    }
    const peoplePayload = (await peopleRes.json()) as { contacts: Person[] };
    setPeople(peoplePayload.contacts);
    if (companiesRes.ok) {
      const companiesPayload = (await companiesRes.json()) as { companies: CompanyOption[] };
      setCompanies(companiesPayload.companies);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setError("");
    setStatus("");
    const body = {
      first_name: editor.first_name,
      last_name: editor.last_name,
      email: editor.email,
      phone: editor.phone || undefined,
      title: editor.title || undefined,
      city: editor.city || undefined,
      notes: editor.notes || undefined,
      company_id: editor.company_id || null,
      company_name:
        companies.find((company) => company.id === editor.company_id)?.name || editor.company_name || undefined,
    };
    const response = selectedId
      ? await fetch(`/api/contacts/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
    if (!response.ok) {
      setError(selectedId ? "Failed to save person" : "Failed to create person");
      return;
    }
    setStatus(selectedId ? "Person saved." : "Person created.");
    setShowForm(false);
    await load();
  }

  const selected = people.find((person) => person.id === selectedId);

  const rows = useMemo(() => people, [people]);

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">People</h1>
          <p className="mt-1 text-sm text-muted">
            People become document variables like <code className="text-foreground">[Client.FirstName]</code>.
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
          + Add person
        </button>
      </div>

      <input
        className={`h-10 w-full max-w-xl ${crmInputClass()}`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && void load()}
        placeholder="Search people…"
      />

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="border-b border-border bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((person) => (
              <tr
                key={person.id}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-slate-50/60"
                onClick={() => {
                  setSelectedId(person.id);
                  setEditor({
                    first_name: person.first_name,
                    last_name: person.last_name,
                    email: person.email,
                    phone: person.phone ?? "",
                    title: person.title ?? "",
                    company_id: person.company_id ?? "",
                    company_name: person.company_name ?? "",
                    city: person.city ?? "",
                    notes: "",
                  });
                  setShowForm(true);
                }}
              >
                <td className="px-4 py-3 font-medium text-foreground">{person.full_name}</td>
                <td className="px-4 py-3 text-muted">{person.email}</td>
                <td className="px-4 py-3 text-muted">{person.company_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{person.title ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{formatRelativeContact(person.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted">No people yet.</p> : null}
      </div>

      {showForm ? (
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{selected ? "Edit person" : "New person"}</h2>
          <div className="mt-3">
            <ClientVariableHint />
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              className={crmInputClass()}
              value={editor.first_name}
              onChange={(event) => setEditor((current) => ({ ...current, first_name: event.target.value }))}
              placeholder="First name"
            />
            <input
              className={crmInputClass()}
              value={editor.last_name}
              onChange={(event) => setEditor((current) => ({ ...current, last_name: event.target.value }))}
              placeholder="Last name"
            />
            <input
              className={`${crmInputClass()} md:col-span-2`}
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
              className={crmInputClass()}
              value={editor.title}
              onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))}
              placeholder="Title"
            />
            <select
              className={crmInputClass()}
              value={editor.company_id}
              onChange={(event) => setEditor((current) => ({ ...current, company_id: event.target.value }))}
            >
              <option value="">No company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <input
              className={crmInputClass()}
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
              {selected ? "Save person" : "Create person"}
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
