"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CrmDataGrid, type CrmGridColumn } from "@/components/crm/data-grid";
import { CrmRecordDrawer, type DrawerSection } from "@/components/crm/record-drawer";
import { formatGridDateTime } from "@/lib/ui/datetime";

type Company = {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  notes: string | null;
  people_count: number;
  created_at: string;
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

const COMPANY_COLUMNS: CrmGridColumn<Company>[] = [
  {
    id: "name",
    label: "Company",
    required: true,
    width: 220,
    sortValue: (company) => company.name,
    cell: (company) => <span className="font-medium text-primary">{company.name}</span>,
  },
  {
    id: "industry",
    label: "Industry",
    width: 160,
    sortValue: (company) => company.industry,
    cell: (company) => company.industry ?? "—",
  },
  {
    id: "people",
    label: "People",
    width: 100,
    align: "right",
    sortValue: (company) => company.people_count,
    cell: (company) => company.people_count,
  },
  {
    id: "website",
    label: "Website",
    width: 200,
    sortValue: (company) => company.website,
    cell: (company) => company.website ?? "—",
  },
  {
    id: "email",
    label: "Email",
    defaultVisible: false,
    width: 200,
    sortValue: (company) => company.email,
    cell: (company) => company.email ?? "—",
  },
  {
    id: "phone",
    label: "Phone",
    defaultVisible: false,
    width: 140,
    sortValue: (company) => company.phone,
    cell: (company) => company.phone ?? "—",
  },
  {
    id: "city",
    label: "City",
    defaultVisible: false,
    width: 140,
    sortValue: (company) => company.city,
    cell: (company) => company.city ?? "—",
  },
  {
    id: "state",
    label: "State",
    defaultVisible: false,
    width: 100,
    sortValue: (company) => company.state,
    cell: (company) => company.state ?? "—",
  },
  {
    id: "country",
    label: "Country",
    defaultVisible: false,
    width: 120,
    sortValue: (company) => company.country,
    cell: (company) => company.country ?? "—",
  },
  {
    id: "created",
    label: "Created",
    defaultVisible: false,
    width: 180,
    sortValue: (company) => company.created_at,
    cell: (company) => formatGridDateTime(company.created_at),
  },
  {
    id: "updated",
    label: "Updated",
    width: 180,
    sortValue: (company) => company.updated_at,
    cell: (company) => formatGridDateTime(company.updated_at),
  },
];

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
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

  const selected = companies.find((company) => company.id === selectedId);

  function openCompany(company: Company) {
    setSelectedId(company.id);
    setEditor({
      name: company.name,
      website: company.website ?? "",
      phone: company.phone ?? "",
      email: company.email ?? "",
      industry: company.industry ?? "",
      city: company.city ?? "",
      notes: company.notes ?? "",
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

  async function patchCompany(body: Record<string, unknown>) {
    if (!selectedId) {
      return;
    }
    setError("");
    const response = await fetch(`/api/companies/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setError("Failed to save company");
      return;
    }
    await load();
  }

  async function createCompany() {
    setError("");
    if (!editor.name.trim()) {
      setError("Company name is required");
      return;
    }
    setCreating(true);
    const response = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editor.name,
        website: editor.website || undefined,
        phone: editor.phone || undefined,
        email: editor.email || undefined,
        industry: editor.industry || undefined,
        city: editor.city || undefined,
        notes: editor.notes || undefined,
      }),
    });
    setCreating(false);
    if (!response.ok) {
      setError("Failed to create company");
      return;
    }
    const payload = (await response.json()) as { company: Company };
    setStatus("Company created.");
    setSelectedId(payload.company.id);
    await load();
  }

  const sections: DrawerSection[] = useMemo(
    () => [
      {
        id: "details",
        label: "Details",
        fields: [
          {
            id: "industry",
            icon: "industry",
            label: "Industry",
            value: editor.industry,
            placeholder: "Industry",
            onChange: (value) => setEditor((current) => ({ ...current, industry: value })),
            onCommit: (value) => void patchCompany({ industry: value }),
          },
          {
            id: "email",
            icon: "mail",
            label: "Email",
            showLabel: false,
            value: editor.email,
            placeholder: "Email",
            onChange: (value) => setEditor((current) => ({ ...current, email: value })),
            onCommit: (value) => void patchCompany({ email: value }),
          },
          {
            id: "phone",
            icon: "phone",
            label: "Phone",
            showLabel: false,
            value: editor.phone,
            placeholder: "Phone",
            onChange: (value) => setEditor((current) => ({ ...current, phone: value })),
            onCommit: (value) => void patchCompany({ phone: value }),
          },
          {
            id: "city",
            icon: "pin",
            label: "Address",
            value: editor.city,
            placeholder: "Address",
            onChange: (value) => setEditor((current) => ({ ...current, city: value })),
            onCommit: (value) => void patchCompany({ city: value }),
          },
        ],
      },
      {
        id: "organization",
        label: "Organization",
        fields: [
          {
            id: "website",
            icon: "web",
            label: "Website",
            value: editor.website,
            placeholder: "Website",
            onChange: (value) => setEditor((current) => ({ ...current, website: value })),
            onCommit: (value) => void patchCompany({ website: value }),
          },
          {
            id: "people",
            icon: "people",
            label: "People",
            value: selected ? String(selected.people_count) : "",
            placeholder: "People",
            readOnly: true,
            onChange: () => undefined,
          },
        ],
      },
    ],
    [editor, selected, selectedId],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <h1 className="sr-only">Companies</h1>
      <CrmDataGrid
        storageKey="crm-grid-companies"
        columns={COMPANY_COLUMNS}
        rows={companies}
        getRowId={(company) => company.id}
        emptyLabel="No companies yet."
        recordNoun="company"
        recordNounPlural="companies"
        search={{
          value: query,
          placeholder: "Search companies…",
          onChange: setQuery,
          onSubmit: () => void load(),
        }}
        addLabel="+ Add company"
        onAdd={openNew}
        onRowOpen={openCompany}
        error={error && !drawerOpen ? error : undefined}
      />
      <CrmRecordDrawer
        open={drawerOpen}
        variant="person"
        recordKey={selectedId ? `${selectedId}-${selected?.updated_at ?? ""}` : "new-company"}
        title={editor.name}
        titlePlaceholder="Company name"
        onTitleChange={(value) => setEditor((current) => ({ ...current, name: value }))}
        onTitleCommit={(value) => void patchCompany({ name: value })}
        onClose={() => setDrawerOpen(false)}
        sections={sections}
        notes={editor.notes}
        onNotesSave={(value) => {
          setEditor((current) => ({ ...current, notes: value }));
          if (selectedId) {
            void patchCompany({ notes: value });
          }
        }}
        onNotesChange={(value) => setEditor((current) => ({ ...current, notes: value }))}
        crmRecord={
          selectedId
            ? {
                type: "company",
                id: selectedId,
                links: {
                  companyId: selectedId,
                  companyName: editor.name,
                },
              }
            : undefined
        }
        error={drawerOpen ? error : undefined}
        status={status}
        createLabel="Create company"
        onCreate={selectedId ? undefined : () => void createCompany()}
        creating={creating}
      />
    </div>
  );
}
