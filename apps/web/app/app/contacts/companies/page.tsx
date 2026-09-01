"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CrmDataGrid, type CrmGridColumn } from "@/components/crm/data-grid";
import { CrmRecordDrawer, type DrawerSection } from "@/components/crm/record-drawer";
import {
  validateEmail,
  validatePhone,
  validateWebsite,
} from "@/lib/crm/contact-field-validation";
import { fetchJson } from "@/lib/crm/fetch-with-auth";
import { formatGridDate, formatGridDateTime } from "@/lib/ui/datetime";

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
  added_by_name: string | null;
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
    cell: (company) => company.industry || null,
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
    cell: (company) => company.website || null,
  },
  {
    id: "email",
    label: "Email",
    defaultVisible: false,
    width: 200,
    sortValue: (company) => company.email,
    cell: (company) => company.email || null,
  },
  {
    id: "phone",
    label: "Phone",
    defaultVisible: false,
    width: 140,
    sortValue: (company) => company.phone,
    cell: (company) => company.phone || null,
  },
  {
    id: "city",
    label: "City",
    defaultVisible: false,
    width: 140,
    sortValue: (company) => company.city,
    cell: (company) => company.city || null,
  },
  {
    id: "state",
    label: "State",
    defaultVisible: false,
    width: 100,
    sortValue: (company) => company.state,
    cell: (company) => company.state || null,
  },
  {
    id: "country",
    label: "Country",
    defaultVisible: false,
    width: 120,
    sortValue: (company) => company.country,
    cell: (company) => company.country || null,
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
  const [currentUserName, setCurrentUserName] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: "200" });
    if (query.trim()) {
      params.set("q", query.trim());
    }
    const payload = await fetchJson<{ companies: Company[] }>(`/api/companies?${params.toString()}`);
    if (!payload) {
      return;
    }
    setCompanies(payload.companies);
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      const response = await fetch("/api/auth/session");
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as { user?: { name?: string; email?: string } | null };
      const name = payload.user?.name?.trim();
      if (name) {
        if (!cancelled) {
          setCurrentUserName(name);
        }
        return;
      }
      const email = payload.user?.email ?? "";
      if (!email || cancelled) {
        return;
      }
      const local = email.split("@")[0] ?? email;
      const derived = local
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      setCurrentUserName(derived || email);
    }
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const saveCompany = useCallback(
    async (body: Record<string, unknown>) => {
    setError("");
    setStatus("");
    if (selectedId) {
      const response = await fetch(`/api/companies/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        setError("Failed to save company");
        return;
      }
      setStatus("Saved.");
      await load();
      return;
    }

    const merged = {
      ...editor,
      ...(typeof body.name === "string" ? { name: body.name } : {}),
      ...(typeof body.website === "string" ? { website: body.website } : {}),
      ...(typeof body.phone === "string" ? { phone: body.phone } : {}),
      ...(typeof body.email === "string" ? { email: body.email } : {}),
      ...(typeof body.industry === "string" ? { industry: body.industry } : {}),
      ...(typeof body.city === "string" ? { city: body.city } : {}),
      ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
    };

    if (!merged.name.trim()) {
      return;
    }

    const response = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: merged.name,
        website: merged.website || undefined,
        phone: merged.phone || undefined,
        email: merged.email || undefined,
        industry: merged.industry || undefined,
        city: merged.city || undefined,
        notes: merged.notes || undefined,
      }),
    });
    if (!response.ok) {
      setError("Failed to save company");
      return;
    }
    const payload = (await response.json()) as { company: Company };
    setSelectedId(payload.company.id);
    setStatus("Saved.");
    await load();
    },
    [selectedId, editor, load],
  );

  const sections: DrawerSection[] = useMemo(
    () => [
      {
        id: "contact-details",
        label: "Contact Details",
        fields: [
          {
            id: "email",
            icon: "mail",
            label: "Email",
            showLabel: false,
            value: editor.email,
            placeholder: "Add email",
            hint: "Work",
            inputType: "email",
            onChange: (value) => setEditor((current) => ({ ...current, email: value })),
            validate: (value) => validateEmail(value),
            onCommit: (value) => void saveCompany({ email: value }),
          },
          {
            id: "phone",
            icon: "phone",
            label: "Phone",
            showLabel: false,
            value: editor.phone,
            placeholder: "Add phone",
            hint: "Work",
            inputType: "tel",
            onChange: (value) => setEditor((current) => ({ ...current, phone: value })),
            validate: (value) => validatePhone(value),
            onCommit: (value) => void saveCompany({ phone: value }),
          },
        ],
      },
      {
        id: "organization",
        label: "Organization",
        fields: [
          {
            id: "org_name",
            icon: "company",
            label: "Organization",
            value: editor.name,
            placeholder: "Organization",
            readOnly: true,
            onChange: () => undefined,
          },
          {
            id: "org_address",
            icon: "pin",
            label: "Address",
            value: editor.city,
            placeholder: "Address",
            onChange: (value) => setEditor((current) => ({ ...current, city: value })),
            onCommit: (value) => void saveCompany({ city: value }),
          },
          {
            id: "org_website",
            icon: "web",
            label: "Website",
            value: editor.website,
            placeholder: "Website",
            onChange: (value) => setEditor((current) => ({ ...current, website: value })),
            inputType: "url",
            validate: (value) => validateWebsite(value),
            onCommit: (value) => void saveCompany({ website: value }),
          },
          {
            id: "org_industry",
            icon: "industry",
            label: "Industry",
            showLabel: true,
            value: editor.industry,
            placeholder: "Industry",
            onChange: (value) => setEditor((current) => ({ ...current, industry: value })),
            onCommit: (value) => void saveCompany({ industry: value }),
          },
        ],
      },
      {
        id: "details",
        label: "Details",
        fields: [
          {
            id: "date_added",
            icon: "calendar",
            label: "Date added",
            showLabel: true,
            value: selected ? formatGridDate(selected.created_at) : "",
            placeholder: "Adds when created",
            readOnly: true,
            onChange: () => undefined,
          },
          {
            id: "added_by",
            icon: "person",
            label: "Added by",
            showLabel: true,
            value: selected?.added_by_name || (!selectedId ? currentUserName : ""),
            placeholder: "Adds when created",
            readOnly: true,
            onChange: () => undefined,
          },
          {
            id: "people_count",
            icon: "people",
            label: "People",
            showLabel: true,
            value: selected ? String(selected.people_count) : "",
            placeholder: "People",
            readOnly: true,
            onChange: () => undefined,
          },
        ],
      },
    ],
    [currentUserName, editor, selected, selectedId, saveCompany],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <h1 className="sr-only">Companies</h1>
      <CrmDataGrid
        storageKey="crm-grid-companies-v2"
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
        onTitleCommit={(value) => void saveCompany({ name: value })}
        onClose={() => {
          setDrawerOpen(false);
          setError("");
        }}
        sections={sections}
        notes={editor.notes}
        onNotesSave={(value) => {
          setEditor((current) => ({ ...current, notes: value }));
          void saveCompany({ notes: value });
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
      />
    </div>
  );
}
