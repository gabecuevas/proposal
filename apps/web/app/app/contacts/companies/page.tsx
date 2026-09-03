"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CrmDataGrid, type CrmGridColumn } from "@/components/crm/data-grid";
import { CrmRecordDrawer, type DrawerSection } from "@/components/crm/record-drawer";
import {
  validateEmail,
  validatePhone,
  validateWebsite,
} from "@/lib/crm/contact-field-validation";
import { fetchJson } from "@/lib/crm/fetch-with-auth";
import { formatGridDate, formatGridDateTime } from "@/lib/ui/datetime";
import { formatAddressDisplay, type AddressValues } from "@/lib/crm/address";
import { normalizeWebsite } from "@/lib/crm/website";

type Company = {
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  industry: string | null;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
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
  address_line_1: string;
  city: string;
  state: string;
  postal_code: string;
  notes: string;
};

function editorAddress(editor: Editor): AddressValues {
  return {
    address_line_1: editor.address_line_1,
    city: editor.city,
    state: editor.state,
    postal_code: editor.postal_code,
  };
}

const emptyEditor = (): Editor => ({
  name: "",
  website: "",
  phone: "",
  email: "",
  industry: "",
  address_line_1: "",
  city: "",
  state: "",
  postal_code: "",
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
  const searchParams = useSearchParams();
  const openedFromQueryRef = useRef<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editor, setEditor] = useState<Editor>(emptyEditor);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
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
      address_line_1: company.address_line_1 ?? "",
      city: company.city ?? "",
      state: company.state ?? "",
      postal_code: company.postal_code ?? "",
      notes: company.notes ?? "",
    });
    setStatus("");
    setError("");
    setDrawerOpen(true);
  }

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || openedFromQueryRef.current === openId || companies.length === 0) {
      return;
    }
    const company = companies.find((item) => item.id === openId);
    if (!company) {
      return;
    }
    openedFromQueryRef.current = openId;
    openCompany(company);
  }, [companies, searchParams]);

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
      ...(typeof body.website === "string" ? { website: normalizeWebsite(body.website) } : {}),
      ...(typeof body.phone === "string" ? { phone: body.phone } : {}),
      ...(typeof body.email === "string" ? { email: body.email } : {}),
      ...(typeof body.industry === "string" ? { industry: body.industry } : {}),
      ...(typeof body.address_line_1 === "string" ? { address_line_1: body.address_line_1 } : {}),
      ...(typeof body.city === "string" ? { city: body.city } : {}),
      ...(typeof body.state === "string" ? { state: body.state } : {}),
      ...(typeof body.postal_code === "string" ? { postal_code: body.postal_code } : {}),
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
        address_line_1: merged.address_line_1 || undefined,
        city: merged.city || undefined,
        state: merged.state || undefined,
        postal_code: merged.postal_code || undefined,
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

  function companyPayloadFromEditor(current: Editor): Record<string, unknown> {
    return {
      name: current.name,
      website: current.website ? normalizeWebsite(current.website) : undefined,
      phone: current.phone || undefined,
      email: current.email || undefined,
      industry: current.industry || undefined,
      address_line_1: current.address_line_1 || undefined,
      city: current.city || undefined,
      state: current.state || undefined,
      postal_code: current.postal_code || undefined,
      notes: current.notes || undefined,
    };
  }

  async function saveCompanyRecord() {
    if (!editor.name.trim()) {
      setError("Company name is required");
      return;
    }
    setSaving(true);
    setError("");
    setStatus("");
    const payload = companyPayloadFromEditor(editor);
    try {
      if (selectedId) {
        const response = await fetch(`/api/companies/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          setError("Failed to save company");
          return;
        }
        await load();
        setDrawerOpen(false);
        setError("");
        setStatus("");
        return;
      }
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        setError("Failed to save company");
        return;
      }
      await load();
      setDrawerOpen(false);
      setError("");
      setStatus("");
    } finally {
      setSaving(false);
    }
  }

  const commitAddress = useCallback(
    (address: AddressValues) => {
      setEditor((current) => ({
        ...current,
        address_line_1: address.address_line_1,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
      }));
      void saveCompany({
        address_line_1: address.address_line_1 || null,
        city: address.city || null,
        state: address.state || null,
        postal_code: address.postal_code || null,
      });
    },
    [saveCompany],
  );

  const commitWebsite = useCallback(
    (value: string) => {
      const website = normalizeWebsite(value);
      setEditor((current) => ({ ...current, website }));
      void saveCompany({ website: website || null });
    },
    [saveCompany],
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
        id: "company",
        label: "Company",
        fields: [
          {
            id: "org_name",
            icon: "company",
            label: "Company",
            value: editor.name,
            placeholder: "Company",
            onChange: (value) => setEditor((current) => ({ ...current, name: value })),
            onCommit: (value) => void saveCompany({ name: value }),
          },
          {
            id: "org_address",
            icon: "pin",
            label: "Address",
            type: "address",
            value: formatAddressDisplay(editorAddress(editor)),
            placeholder: "Address",
            address: editorAddress(editor),
            onChange: () => undefined,
            onAddressChange: (address) =>
              setEditor((current) => ({
                ...current,
                address_line_1: address.address_line_1,
                city: address.city,
                state: address.state,
                postal_code: address.postal_code,
              })),
            onAddressCommit: (address) => void commitAddress(address),
          },
          {
            id: "org_website",
            icon: "web",
            label: "Website",
            type: "website",
            value: editor.website,
            placeholder: "www.example.com",
            onChange: (value) => setEditor((current) => ({ ...current, website: value })),
            validate: (value) => validateWebsite(value),
            onCommit: (value) => void commitWebsite(value),
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
    [commitAddress, commitWebsite, currentUserName, editor, selected, selectedId, saveCompany],
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
        footerSave={{
          label: selectedId ? "Save" : "Save company",
          saving,
          onSave: () => void saveCompanyRecord(),
        }}
      />
    </div>
  );
}
