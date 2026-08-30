"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CrmDataGrid, type CrmGridColumn } from "@/components/crm/data-grid";
import { CrmRecordDrawer, type DrawerSection } from "@/components/crm/record-drawer";
import { formatGridDateTime } from "@/lib/ui/datetime";

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
  state: string | null;
  country: string | null;
  website: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

type CompanyOption = {
  id: string;
  name: string;
  website?: string | null;
  city?: string | null;
  industry?: string | null;
};

type Editor = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  title: string;
  company_id: string;
  company_name: string;
  city: string;
  website: string;
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
  website: "",
  notes: "",
});

function ContactLink({ children }: { children: string }) {
  return <span className="font-medium text-primary">{children}</span>;
}

function LabeledValue({ value, hint }: { value: string | null | undefined; hint: string }) {
  if (!value) {
    return <span>—</span>;
  }
  return (
    <span>
      {value} <span className="text-muted">({hint})</span>
    </span>
  );
}

const PEOPLE_COLUMNS: CrmGridColumn<Person>[] = [
  {
    id: "name",
    label: "Name",
    required: true,
    width: 200,
    sortValue: (person) => person.full_name,
    cell: (person) => <ContactLink>{person.full_name}</ContactLink>,
  },
  {
    id: "company",
    label: "Organization",
    width: 180,
    sortValue: (person) => person.company_name,
    cell: (person) => (person.company_name ? <ContactLink>{person.company_name}</ContactLink> : "—"),
  },
  {
    id: "email",
    label: "Email",
    width: 240,
    sortValue: (person) => person.email,
    cell: (person) => <LabeledValue value={person.email} hint="Work" />,
  },
  {
    id: "phone",
    label: "Phone",
    width: 180,
    sortValue: (person) => person.phone,
    cell: (person) => <LabeledValue value={person.phone} hint="Work" />,
  },
  {
    id: "title",
    label: "Title",
    defaultVisible: false,
    width: 160,
    sortValue: (person) => person.title,
    cell: (person) => person.title ?? "—",
  },
  {
    id: "city",
    label: "City",
    defaultVisible: false,
    width: 140,
    sortValue: (person) => person.city,
    cell: (person) => person.city ?? "—",
  },
  {
    id: "state",
    label: "State",
    defaultVisible: false,
    width: 100,
    sortValue: (person) => person.state,
    cell: (person) => person.state ?? "—",
  },
  {
    id: "country",
    label: "Country",
    defaultVisible: false,
    width: 120,
    sortValue: (person) => person.country,
    cell: (person) => person.country ?? "—",
  },
  {
    id: "website",
    label: "Website",
    defaultVisible: false,
    width: 180,
    sortValue: (person) => person.website,
    cell: (person) => person.website ?? "—",
  },
  {
    id: "tags",
    label: "Tags",
    defaultVisible: false,
    width: 160,
    sortValue: (person) => person.tags?.join(", "),
    cell: (person) => (person.tags?.length ? person.tags.join(", ") : "—"),
  },
  {
    id: "created",
    label: "Created",
    defaultVisible: false,
    width: 180,
    sortValue: (person) => person.created_at,
    cell: (person) => formatGridDateTime(person.created_at),
  },
  {
    id: "updated",
    label: "Updated",
    defaultVisible: false,
    width: 180,
    sortValue: (person) => person.updated_at,
    cell: (person) => formatGridDateTime(person.updated_at),
  },
];

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
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

  const selected = people.find((person) => person.id === selectedId);
  const displayName = `${editor.first_name} ${editor.last_name}`.trim();

  function openPerson(person: Person) {
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
      website: person.website ?? "",
      notes: person.notes ?? "",
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

  async function patchPerson(body: Record<string, unknown>) {
    if (!selectedId) {
      return;
    }
    setError("");
    const response = await fetch(`/api/contacts/${selectedId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      setError("Failed to save person");
      return;
    }
    await load();
  }

  async function createPerson() {
    setError("");
    if (!editor.first_name.trim() || !editor.last_name.trim() || !editor.email.trim()) {
      setError("First name, last name, and email are required");
      return;
    }
    setCreating(true);
    const response = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: editor.first_name,
        last_name: editor.last_name,
        email: editor.email,
        phone: editor.phone || undefined,
        title: editor.title || undefined,
        city: editor.city || undefined,
        website: editor.website || undefined,
        notes: editor.notes || undefined,
        company_id: editor.company_id || null,
        company_name:
          companies.find((company) => company.id === editor.company_id)?.name || editor.company_name || undefined,
      }),
    });
    setCreating(false);
    if (!response.ok) {
      setError("Failed to create person");
      return;
    }
    const payload = (await response.json()) as { contact: Person };
    setStatus("Person created.");
    setSelectedId(payload.contact.id);
    await load();
  }

  const linkedCompany = companies.find((company) => company.id === editor.company_id);

  const sections: DrawerSection[] = useMemo(
    () => [
      {
        id: "summary",
        label: "Summary",
        fields: [
          {
            id: "email",
            icon: "mail",
            label: "Email",
            value: editor.email,
            placeholder: "Add email",
            hint: "Work",
            onChange: (value) => setEditor((current) => ({ ...current, email: value })),
            onCommit: (value) => void patchPerson({ email: value }),
          },
          {
            id: "phone",
            icon: "phone",
            label: "Phone",
            value: editor.phone,
            placeholder: "Add phone",
            hint: "Work",
            onChange: (value) => setEditor((current) => ({ ...current, phone: value })),
            onCommit: (value) => void patchPerson({ phone: value }),
          },
          {
            id: "company_id",
            icon: "company",
            label: "Organization",
            type: "select",
            value: editor.company_id,
            placeholder: "Organization",
            options: companies.map((company) => ({ value: company.id, label: company.name })),
            onChange: (value) => setEditor((current) => ({ ...current, company_id: value })),
            onCommit: (value) =>
              void patchPerson({
                company_id: value || null,
                company_name: companies.find((company) => company.id === value)?.name,
              }),
          },
        ],
      },
      {
        id: "details",
        label: "Details",
        fields: [
          {
            id: "first_name",
            icon: "person",
            label: "First name",
            showLabel: true,
            value: editor.first_name,
            placeholder: "First name",
            onChange: (value) => setEditor((current) => ({ ...current, first_name: value })),
            onCommit: (value) => void patchPerson({ first_name: value }),
          },
          {
            id: "last_name",
            icon: "person",
            label: "Last name",
            showLabel: true,
            value: editor.last_name,
            placeholder: "Last name",
            onChange: (value) => setEditor((current) => ({ ...current, last_name: value })),
            onCommit: (value) => void patchPerson({ last_name: value }),
          },
          {
            id: "title",
            icon: "title",
            label: "Title",
            showLabel: true,
            value: editor.title,
            placeholder: "Title",
            onChange: (value) => setEditor((current) => ({ ...current, title: value })),
            onCommit: (value) => void patchPerson({ title: value }),
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
            value: linkedCompany?.name ?? editor.company_name,
            placeholder: "Organization",
            readOnly: true,
            onChange: () => undefined,
          },
          {
            id: "org_address",
            icon: "pin",
            label: "Address",
            value: linkedCompany?.city ?? editor.city,
            placeholder: "Address",
            onChange: (value) => setEditor((current) => ({ ...current, city: value })),
            onCommit: (value) => void patchPerson({ city: value }),
          },
          {
            id: "org_website",
            icon: "web",
            label: "Website",
            value: linkedCompany?.website ?? editor.website,
            placeholder: "Website",
            onChange: (value) => setEditor((current) => ({ ...current, website: value })),
            onCommit: (value) => void patchPerson({ website: value }),
          },
          {
            id: "org_industry",
            icon: "industry",
            label: "Industry",
            value: linkedCompany?.industry ?? "",
            placeholder: "Industry",
            readOnly: true,
            onChange: () => undefined,
          },
        ],
      },
      {
        id: "deals",
        label: "Deals",
        fields: [],
      },
    ],
    [companies, editor, linkedCompany, selectedId],
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <h1 className="sr-only">People</h1>
      <CrmDataGrid
        storageKey="crm-grid-people-v2"
        columns={PEOPLE_COLUMNS}
        rows={people}
        getRowId={(person) => person.id}
        emptyLabel="No people yet."
        recordNoun="person"
        recordNounPlural="people"
        search={{
          value: query,
          placeholder: "Search people…",
          onChange: setQuery,
          onSubmit: () => void load(),
        }}
        addLabel="+ Add person"
        onAdd={openNew}
        onRowOpen={openPerson}
        error={error && !drawerOpen ? error : undefined}
      />
      <CrmRecordDrawer
        open={drawerOpen}
        variant="person"
        recordKey={selectedId || "new-person"}
        title={displayName}
        titlePlaceholder="Person name"
        onTitleChange={(value) => {
          const parts = value.trim().split(/\s+/);
          setEditor((current) => ({
            ...current,
            first_name: parts[0] ?? "",
            last_name: parts.slice(1).join(" "),
          }));
        }}
        onTitleCommit={(value) => {
          const parts = value.trim().split(/\s+/);
          void patchPerson({
            first_name: parts[0] ?? "",
            last_name: parts.slice(1).join(" "),
          });
        }}
        onClose={() => setDrawerOpen(false)}
        sections={sections}
        notes={editor.notes}
        onNotesSave={(value) => {
          setEditor((current) => ({ ...current, notes: value }));
          if (selectedId) {
            void patchPerson({ notes: value });
          }
        }}
        onNotesChange={(value) => setEditor((current) => ({ ...current, notes: value }))}
        history={
          selected
            ? [
                ...(selected.notes
                  ? [{ id: "note", title: "Note", at: selected.updated_at, detail: selected.notes, kind: "note" as const }]
                  : []),
                { id: "created", title: "Person created", at: selected.created_at, kind: "created" as const },
              ]
            : []
        }
        error={drawerOpen ? error : undefined}
        status={status}
        createLabel="Create person"
        onCreate={selectedId ? undefined : () => void createPerson()}
        creating={creating}
      />
    </div>
  );
}
