"use client";

import { useCallback, useEffect, useState } from "react";
import { crmInputClass } from "@/components/crm/variable-pills";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/crm/lead-status";
import { formatRelativeContact } from "@/lib/ui/time";

type Lead = {
  id: string;
  title: string;
  status: LeadStatus;
  source: string | null;
  value_minor: number | null;
  currency: string;
  person_id: string | null;
  company_id: string | null;
  email: string | null;
  phone: string | null;
  person_name: string | null;
  company_name: string | null;
  updated_at: string;
};

type Option = { id: string; name?: string; full_name?: string };

type Editor = {
  title: string;
  status: LeadStatus;
  source: string;
  value: string;
  person_id: string;
  company_id: string;
  email: string;
  phone: string;
  notes: string;
};

const emptyEditor = (): Editor => ({
  title: "",
  status: "NEW",
  source: "",
  value: "",
  person_id: "",
  company_id: "",
  email: "",
  phone: "",
  notes: "",
});

function statusClass(status: LeadStatus): string {
  const base = "inline-flex rounded-md px-2 py-0.5 text-xs font-medium";
  if (status === "NEW") {
    return `${base} bg-sky-100 text-sky-800`;
  }
  if (status === "CONTACTED") {
    return `${base} bg-indigo-100 text-indigo-800`;
  }
  if (status === "QUALIFIED") {
    return `${base} bg-emerald-100 text-emerald-800`;
  }
  if (status === "CONVERTED") {
    return `${base} bg-primary/10 text-primary`;
  }
  return `${base} bg-slate-100 text-slate-700`;
}

function dollarsToMinor(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || value.trim() === "") {
    return null;
  }
  return Math.round(parsed * 100);
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [people, setPeople] = useState<Option[]>([]);
  const [companies, setCompanies] = useState<Option[]>([]);
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
    const [leadsRes, peopleRes, companiesRes] = await Promise.all([
      fetch(`/api/leads?${params.toString()}`),
      fetch("/api/contacts?limit=200"),
      fetch("/api/companies?limit=200"),
    ]);
    if (!leadsRes.ok) {
      setError("Failed to load leads");
      return;
    }
    const leadsPayload = (await leadsRes.json()) as { leads: Lead[] };
    setLeads(leadsPayload.leads);
    if (peopleRes.ok) {
      const payload = (await peopleRes.json()) as { contacts: Array<{ id: string; full_name: string }> };
      setPeople(payload.contacts);
    }
    if (companiesRes.ok) {
      const payload = (await companiesRes.json()) as { companies: Array<{ id: string; name: string }> };
      setCompanies(payload.companies);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setError("");
    setStatus("");
    const body = {
      title: editor.title,
      status: editor.status,
      source: editor.source || undefined,
      value_minor: dollarsToMinor(editor.value),
      person_id: editor.person_id || null,
      company_id: editor.company_id || null,
      email: editor.email || undefined,
      phone: editor.phone || undefined,
      notes: editor.notes || undefined,
    };
    const response = selectedId
      ? await fetch(`/api/leads/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      : await fetch("/api/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
    if (!response.ok) {
      setError(selectedId ? "Failed to save lead" : "Failed to create lead");
      return;
    }
    setStatus(selectedId ? "Lead saved." : "Lead created.");
    setShowForm(false);
    await load();
  }

  const selected = leads.find((lead) => lead.id === selectedId);

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Leads</h1>
          <p className="mt-1 text-sm text-muted">
            Qualify incoming opportunities, then convert them into people and companies for documents.
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
          + Add lead
        </button>
      </div>

      <input
        className={`h-10 w-full max-w-xl ${crmInputClass()}`}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => event.key === "Enter" && void load()}
        placeholder="Search leads…"
      />

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <thead className="border-b border-border bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <tr
                key={lead.id}
                className="cursor-pointer border-b border-border last:border-0 hover:bg-slate-50/60"
                onClick={() => {
                  setSelectedId(lead.id);
                  setEditor({
                    title: lead.title,
                    status: lead.status,
                    source: lead.source ?? "",
                    value: lead.value_minor != null ? String(lead.value_minor / 100) : "",
                    person_id: lead.person_id ?? "",
                    company_id: lead.company_id ?? "",
                    email: lead.email ?? "",
                    phone: lead.phone ?? "",
                    notes: "",
                  });
                  setShowForm(true);
                }}
              >
                <td className="px-4 py-3 font-medium text-foreground">{lead.title}</td>
                <td className="px-4 py-3 text-muted">{lead.person_name ?? "—"}</td>
                <td className="px-4 py-3 text-muted">{lead.company_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={statusClass(lead.status)}>{lead.status.replace("_", " ")}</span>
                </td>
                <td className="px-4 py-3 text-muted">{formatRelativeContact(lead.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted">No leads yet.</p> : null}
      </div>

      {showForm ? (
        <section className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{selected ? "Edit lead" : "New lead"}</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              className={`${crmInputClass()} md:col-span-2`}
              value={editor.title}
              onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))}
              placeholder="Lead title"
            />
            <select
              className={crmInputClass()}
              value={editor.status}
              onChange={(event) =>
                setEditor((current) => ({ ...current, status: event.target.value as LeadStatus }))
              }
            >
              {LEAD_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item.charAt(0) + item.slice(1).toLowerCase().replace("_", " ")}
                </option>
              ))}
            </select>
            <input
              className={crmInputClass()}
              value={editor.source}
              onChange={(event) => setEditor((current) => ({ ...current, source: event.target.value }))}
              placeholder="Source"
            />
            <select
              className={crmInputClass()}
              value={editor.person_id}
              onChange={(event) => setEditor((current) => ({ ...current, person_id: event.target.value }))}
            >
              <option value="">No person</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.full_name}
                </option>
              ))}
            </select>
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
              value={editor.value}
              onChange={(event) => setEditor((current) => ({ ...current, value: event.target.value }))}
              placeholder="Value (USD)"
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
              {selected ? "Save lead" : "Create lead"}
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
