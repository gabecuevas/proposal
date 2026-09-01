"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CrmDataGrid, type CrmGridColumn } from "@/components/crm/data-grid";
import { CrmRecordDrawer, type DrawerSection } from "@/components/crm/record-drawer";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/crm/lead-status";
import { formatGridDateTime, formatMinorCurrency } from "@/lib/ui/datetime";

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
  notes: string | null;
  person_name: string | null;
  company_name: string | null;
  created_at: string;
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

function formatStatus(status: LeadStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase().replace("_", " ");
}

function dollarsToMinor(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || value.trim() === "") {
    return null;
  }
  return Math.round(parsed * 100);
}

const LEAD_COLUMNS: CrmGridColumn<Lead>[] = [
  {
    id: "title",
    label: "Title",
    required: true,
    width: 220,
    sortValue: (lead) => lead.title,
    cell: (lead) => <span className="font-medium text-primary">{lead.title}</span>,
  },
  {
    id: "person",
    label: "Person",
    width: 160,
    sortValue: (lead) => lead.person_name,
    cell: (lead) => lead.person_name ?? "—",
  },
  {
    id: "company",
    label: "Company",
    width: 160,
    sortValue: (lead) => lead.company_name,
    cell: (lead) => lead.company_name ?? "—",
  },
  {
    id: "status",
    label: "Status",
    width: 130,
    sortValue: (lead) => lead.status,
    cell: (lead) => <span className={statusClass(lead.status)}>{formatStatus(lead.status)}</span>,
  },
  {
    id: "source",
    label: "Source",
    defaultVisible: false,
    width: 140,
    sortValue: (lead) => lead.source,
    cell: (lead) => lead.source ?? "—",
  },
  {
    id: "email",
    label: "Email",
    defaultVisible: false,
    width: 200,
    sortValue: (lead) => lead.email,
    cell: (lead) => lead.email ?? "—",
  },
  {
    id: "phone",
    label: "Phone",
    defaultVisible: false,
    width: 140,
    sortValue: (lead) => lead.phone,
    cell: (lead) => lead.phone ?? "—",
  },
  {
    id: "value",
    label: "Value",
    defaultVisible: false,
    width: 120,
    align: "right",
    sortValue: (lead) => lead.value_minor,
    cell: (lead) => formatMinorCurrency(lead.value_minor, lead.currency),
  },
  {
    id: "created",
    label: "Created",
    defaultVisible: false,
    width: 180,
    sortValue: (lead) => lead.created_at,
    cell: (lead) => formatGridDateTime(lead.created_at),
  },
  {
    id: "updated",
    label: "Updated",
    width: 180,
    sortValue: (lead) => lead.updated_at,
    cell: (lead) => formatGridDateTime(lead.updated_at),
  },
];

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [people, setPeople] = useState<Option[]>([]);
  const [companies, setCompanies] = useState<Option[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editor, setEditor] = useState<Editor>(emptyEditor);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [creating, setCreating] = useState(false);

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

  const selected = leads.find((lead) => lead.id === selectedId);

  function openLead(lead: Lead) {
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
      notes: lead.notes ?? "",
    });
    setStatus("");
    setError("");
    setDrawerOpen(true);
  }

  function openNew() {
    setSelectedId("");
    setEditor(emptyEditor());
    setStatus("");
    setError("");
    setDrawerOpen(true);
  }

  async function patchLead(body: Record<string, unknown>) {
    if (!selectedId) {
      return;
    }
    setError("");
    const response = await fetch(`/api/leads/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setError("Failed to save lead");
      return;
    }
    await load();
  }

  async function createLead() {
    setError("");
    if (!editor.title.trim()) {
      setError("Title is required");
      return;
    }
    setCreating(true);
    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editor.title,
        status: editor.status,
        source: editor.source || undefined,
        value_minor: dollarsToMinor(editor.value),
        person_id: editor.person_id || null,
        company_id: editor.company_id || null,
        email: editor.email || undefined,
        phone: editor.phone || undefined,
        notes: editor.notes || undefined,
      }),
    });
    setCreating(false);
    if (!response.ok) {
      setError("Failed to create lead");
      return;
    }
    const payload = (await response.json()) as { lead: Lead };
    setStatus("Lead created.");
    setSelectedId(payload.lead.id);
    await load();
  }

  const sections: DrawerSection[] = useMemo(
    () => [
      {
        id: "details",
        label: "Details",
        fields: [
          {
            id: "status",
            icon: "status",
            label: "Status",
            type: "select",
            value: editor.status,
            placeholder: "Status",
            options: LEAD_STATUSES.map((item) => ({ value: item, label: formatStatus(item) })),
            onChange: (value) => setEditor((current) => ({ ...current, status: value as LeadStatus })),
            onCommit: (value) => void patchLead({ status: value }),
          },
          {
            id: "value",
            icon: "value",
            label: "Value",
            value: editor.value,
            placeholder: "Value",
            onChange: (value) => setEditor((current) => ({ ...current, value })),
            onCommit: (value) => void patchLead({ value_minor: dollarsToMinor(value) }),
          },
          {
            id: "source",
            icon: "source",
            label: "Source",
            value: editor.source,
            placeholder: "Source origin",
            onChange: (value) => setEditor((current) => ({ ...current, source: value })),
            onCommit: (value) => void patchLead({ source: value }),
          },
        ],
      },
      {
        id: "person",
        label: "Person",
        fields: [
          {
            id: "person_id",
            icon: "person",
            label: "Person",
            type: "select",
            value: editor.person_id,
            placeholder: "Person",
            options: people.map((person) => ({ value: person.id, label: person.full_name ?? "" })),
            onChange: (value) => setEditor((current) => ({ ...current, person_id: value })),
            onCommit: (value) => void patchLead({ person_id: value || null }),
          },
          {
            id: "email",
            icon: "mail",
            label: "Email",
            showLabel: false,
            value: editor.email,
            placeholder: "Email",
            onChange: (value) => setEditor((current) => ({ ...current, email: value })),
            onCommit: (value) => void patchLead({ email: value }),
          },
          {
            id: "phone",
            icon: "phone",
            label: "Phone",
            showLabel: false,
            value: editor.phone,
            placeholder: "Phone",
            onChange: (value) => setEditor((current) => ({ ...current, phone: value })),
            onCommit: (value) => void patchLead({ phone: value }),
          },
        ],
      },
      {
        id: "organization",
        label: "Organization",
        fields: [
          {
            id: "company_id",
            icon: "company",
            label: "Company",
            type: "select",
            value: editor.company_id,
            placeholder: "Organization",
            options: companies.map((company) => ({ value: company.id, label: company.name ?? "" })),
            onChange: (value) => setEditor((current) => ({ ...current, company_id: value })),
            onCommit: (value) => void patchLead({ company_id: value || null }),
          },
        ],
      },
    ],
    [companies, editor, people, selectedId],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <h1 className="sr-only">Leads</h1>
      <CrmDataGrid
        storageKey="crm-grid-leads"
        columns={LEAD_COLUMNS}
        rows={leads}
        getRowId={(lead) => lead.id}
        emptyLabel="No leads yet."
        recordNoun="lead"
        search={{
          value: query,
          placeholder: "Search leads…",
          onChange: setQuery,
          onSubmit: () => void load(),
        }}
        addLabel="+ Add lead"
        onAdd={openNew}
        onRowOpen={openLead}
        error={error && !drawerOpen ? error : undefined}
      />
      <CrmRecordDrawer
        open={drawerOpen}
        recordKey={selectedId || "new-lead"}
        title={editor.title}
        titlePlaceholder="Lead title"
        onTitleChange={(value) => setEditor((current) => ({ ...current, title: value }))}
        onTitleCommit={(value) => void patchLead({ title: value })}
        onClose={() => setDrawerOpen(false)}
        sections={sections}
        notes={editor.notes}
        onNotesSave={(value) => {
          setEditor((current) => ({ ...current, notes: value }));
          if (selectedId) {
            void patchLead({ notes: value });
          }
        }}
        onNotesChange={(value) => setEditor((current) => ({ ...current, notes: value }))}
        history={
          selected
            ? [
                ...(selected.notes
                  ? [{ id: "note", title: "Note", at: selected.updated_at, detail: selected.notes }]
                  : []),
                { id: "created", title: "Lead created", at: selected.created_at },
              ]
            : []
        }
        error={drawerOpen ? error : undefined}
        status={status}
        createLabel="Create lead"
        onCreate={selectedId ? undefined : () => void createLead()}
        creating={creating}
      />
    </div>
  );
}
