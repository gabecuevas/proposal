"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CrmDataGrid, type CrmGridColumn } from "@/components/crm/data-grid";
import { CrmRecordDrawer, type DrawerSection } from "@/components/crm/record-drawer";
import { contactSourceOptions } from "@/lib/crm/contact-sources";
import { fetchJson } from "@/lib/crm/fetch-with-auth";
import { splitContactName } from "@/lib/crm/split-contact-name";
import {
  firstContactDetailsError,
  validateEmail,
  validatePersonName,
  validatePhone,
  validateTitle,
  validateWebsite,
} from "@/lib/crm/contact-field-validation";
import { formatGridDate, formatGridDateTime } from "@/lib/ui/datetime";

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
  source: string | null;
  added_by_name: string | null;
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
  source: string;
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
  source: "",
});

function ContactLink({ children }: { children: string }) {
  return <span className="font-medium text-primary">{children}</span>;
}

function LabeledValue({ value, hint }: { value: string | null | undefined; hint: string }) {
  if (!value) {
    return <span />;
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
    cell: (person) => (person.company_name ? <ContactLink>{person.company_name}</ContactLink> : null),
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
    cell: (person) => person.title || null,
  },
  {
    id: "city",
    label: "City",
    defaultVisible: false,
    width: 140,
    sortValue: (person) => person.city,
    cell: (person) => person.city || null,
  },
  {
    id: "state",
    label: "State",
    defaultVisible: false,
    width: 100,
    sortValue: (person) => person.state,
    cell: (person) => person.state || null,
  },
  {
    id: "country",
    label: "Country",
    defaultVisible: false,
    width: 120,
    sortValue: (person) => person.country,
    cell: (person) => person.country || null,
  },
  {
    id: "website",
    label: "Website",
    defaultVisible: false,
    width: 180,
    sortValue: (person) => person.website,
    cell: (person) => person.website || null,
  },
  {
    id: "tags",
    label: "Tags",
    defaultVisible: false,
    width: 160,
    sortValue: (person) => person.tags?.join(", "),
    cell: (person) => (person.tags?.length ? person.tags.join(", ") : null),
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
  const [currentUserName, setCurrentUserName] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams({ limit: "200" });
    if (query.trim()) {
      params.set("q", query.trim());
    }
    const [peoplePayload, companiesPayload] = await Promise.all([
      fetchJson<{ contacts: Person[] }>(`/api/contacts?${params.toString()}`),
      fetchJson<{ companies: CompanyOption[] }>("/api/companies?limit=200"),
    ]);
    if (!peoplePayload) {
      return;
    }
    setPeople(peoplePayload.contacts);
    if (companiesPayload) {
      setCompanies(companiesPayload.companies);
    }
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
      const payload = (await response.json()) as { user?: { email?: string } | null };
      const email = payload.user?.email ?? "";
      if (!email || cancelled) {
        return;
      }
      const local = email.split("@")[0] ?? email;
      const name = local
        .split(/[._-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
      setCurrentUserName(name || email);
    }
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

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
      source: person.source ?? "",
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

  async function savePerson(body: Record<string, unknown>) {
    setError("");
    setStatus("");
    if (selectedId) {
      const response = await fetch(`/api/contacts/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(payload?.error?.message ?? "Failed to save person");
        return;
      }
      setStatus("Saved.");
      await load();
      return;
    }

    const merged = {
      ...editor,
      ...(typeof body.first_name === "string" ? { first_name: body.first_name } : {}),
      ...(typeof body.last_name === "string" ? { last_name: body.last_name } : {}),
      ...(typeof body.email === "string" ? { email: body.email } : {}),
      ...(typeof body.phone === "string" ? { phone: body.phone } : {}),
      ...(typeof body.title === "string" ? { title: body.title } : {}),
      ...(typeof body.city === "string" ? { city: body.city } : {}),
      ...(typeof body.website === "string" ? { website: body.website } : {}),
      ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
      ...(body.source !== undefined ? { source: typeof body.source === "string" ? body.source : "" } : {}),
      ...(body.company_id !== undefined
        ? { company_id: typeof body.company_id === "string" ? body.company_id : "" }
        : {}),
    };

    const detailsError = firstContactDetailsError({
      first_name: merged.first_name,
      last_name: merged.last_name,
      email: merged.email,
      phone: merged.phone,
      title: merged.title,
      website: merged.website,
    });
    if (detailsError) {
      return;
    }

    const response = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: merged.first_name,
        last_name: merged.last_name,
        email: merged.email,
        phone: merged.phone || undefined,
        title: merged.title || undefined,
        city: merged.city || undefined,
        website: merged.website || undefined,
        notes: merged.notes || undefined,
        source: merged.source || undefined,
        company_id: merged.company_id || null,
        company_name:
          companies.find((company) => company.id === merged.company_id)?.name ||
          merged.company_name ||
          undefined,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(payload?.error?.message ?? "Failed to save person");
      return;
    }
    const payload = (await response.json()) as { contact: Person };
    setSelectedId(payload.contact.id);
    setStatus("Saved.");
    await load();
  }

  const linkedCompany = companies.find((company) => company.id === editor.company_id);

  const sections: DrawerSection[] = useMemo(
    () => [
      {
        id: "contact-details",
        label: "Contact Details",
        fields: [
          {
            id: "first_name",
            icon: "person",
            label: "First name",
            showLabel: true,
            value: editor.first_name,
            placeholder: "First name",
            onChange: (value) => setEditor((current) => ({ ...current, first_name: value })),
            validate: (value) => validatePersonName(value, "First name"),
            onCommit: (value) => void savePerson({ first_name: value }),
          },
          {
            id: "last_name",
            icon: "person",
            label: "Last name",
            showLabel: true,
            value: editor.last_name,
            placeholder: "Last name",
            onChange: (value) => setEditor((current) => ({ ...current, last_name: value })),
            validate: (value) => validatePersonName(value, "Last name"),
            onCommit: (value) => void savePerson({ last_name: value }),
          },
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
            onCommit: (value) => void savePerson({ email: value }),
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
            onCommit: (value) => void savePerson({ phone: value }),
          },
          {
            id: "title",
            icon: "title",
            label: "Title",
            showLabel: true,
            value: editor.title,
            placeholder: "Title",
            onChange: (value) => setEditor((current) => ({ ...current, title: value })),
            validate: (value) => validateTitle(value),
            onCommit: (value) => void savePerson({ title: value }),
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
            label: "Organization",
            showLabel: false,
            type: "select",
            value: editor.company_id,
            placeholder: "Organization",
            options: [
              { value: "", label: "None" },
              ...companies.map((company) => ({ value: company.id, label: company.name })),
            ],
            onChange: (value) =>
              setEditor((current) => ({
                ...current,
                company_id: value,
                company_name: companies.find((company) => company.id === value)?.name ?? "",
              })),
            onCommit: (value) => {
              const company = companies.find((item) => item.id === value);
              void savePerson({
                company_id: value || null,
                company_name: company?.name ?? null,
              });
            },
          },
          {
            id: "org_address",
            icon: "pin",
            label: "Address",
            value: linkedCompany?.city ?? editor.city,
            placeholder: "Address",
            onChange: (value) => setEditor((current) => ({ ...current, city: value })),
            onCommit: (value) => void savePerson({ city: value }),
          },
          {
            id: "org_website",
            icon: "web",
            label: "Website",
            value: linkedCompany?.website ?? editor.website,
            placeholder: "Website",
            onChange: (value) => setEditor((current) => ({ ...current, website: value })),
            inputType: "url",
            validate: (value) => validateWebsite(value),
            onCommit: (value) => void savePerson({ website: value }),
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
            id: "source",
            icon: "source",
            label: "Source",
            showLabel: true,
            type: "select",
            value: editor.source,
            placeholder: "Select source",
            options: contactSourceOptions(editor.source),
            onChange: (value) => setEditor((current) => ({ ...current, source: value })),
            onCommit: (value) => void savePerson({ source: value || null }),
          },
        ],
      },
    ],
    [companies, currentUserName, editor, linkedCompany, selected, selectedId],
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
        recordKey={selectedId ? `${selectedId}-${selected?.updated_at ?? ""}` : "new-person"}
        title={displayName}
        titlePlaceholder="Contact name"
        onTitleChange={(value) => {
          setEditor((current) => ({
            ...current,
            ...splitContactName(value),
          }));
        }}
        onTitleCommit={(value) => {
          const names = splitContactName(value);
          const nameError =
            validatePersonName(names.first_name, "First name") ??
            validatePersonName(names.last_name, "Last name");
          if (nameError) {
            setError(nameError);
            return;
          }
          void savePerson(names);
        }}
        onClose={() => {
          setDrawerOpen(false);
          setError("");
        }}
        sections={sections}
        notes={editor.notes}
        onNotesSave={(value) => {
          setEditor((current) => ({ ...current, notes: value }));
          void savePerson({ notes: value });
        }}
        onNotesChange={(value) => setEditor((current) => ({ ...current, notes: value }))}
        crmRecord={
          selectedId
            ? {
                type: "contact",
                id: selectedId,
                links: {
                  contactId: selectedId,
                  contactName: displayName,
                  companyId: editor.company_id || undefined,
                  companyName: linkedCompany?.name || editor.company_name || undefined,
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
