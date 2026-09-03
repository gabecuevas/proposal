"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CrmDataGrid, type CrmGridColumn } from "@/components/crm/data-grid";
import { CrmRecordDrawer, type DrawerSection } from "@/components/crm/record-drawer";
import {
  leadContactDetailsError,
  validateEmail,
  validatePersonName,
  validatePhone,
  validateTitle,
  validateWebsite,
} from "@/lib/crm/contact-field-validation";
import { contactSourceOptions, contactSourceLabel } from "@/lib/crm/contact-sources";
import { LEAD_STATUSES, type LeadStatus } from "@/lib/crm/lead-status";
import { fetchJson } from "@/lib/crm/fetch-with-auth";
import { splitContactName } from "@/lib/crm/split-contact-name";
import { formatGridDate, formatGridDateTime, formatMinorCurrency } from "@/lib/ui/datetime";
import {
  resolveCompanyAssociation,
  type CompanySearchResult,
} from "@/lib/crm/resolve-company-association";
import {
  formatAddressDisplay,
  type AddressValues,
} from "@/lib/crm/address";
import { normalizeWebsite } from "@/lib/crm/website";

type Lead = {
  id: string;
  title: string;
  status: LeadStatus;
  source: string | null;
  value_minor: number | null;
  currency: string;
  person_id: string | null;
  company_id: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  contact_title: string | null;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  website: string | null;
  notes: string | null;
  tags: string[];
  person_name: string | null;
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
  title: string;
  status: LeadStatus;
  source: string;
  value: string;
  person_id: string;
  company_id: string;
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  contact_title: string;
  address_line_1: string;
  city: string;
  state: string;
  postal_code: string;
  website: string;
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
  title: "",
  status: "NEW",
  source: "",
  value: "",
  person_id: "",
  company_id: "",
  company_name: "",
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  contact_title: "",
  address_line_1: "",
  city: "",
  state: "",
  postal_code: "",
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
    id: "name",
    label: "Name",
    required: true,
    width: 200,
    sortValue: (lead) => lead.full_name ?? lead.person_name,
    cell: (lead) => {
      const name = lead.full_name ?? lead.person_name;
      return name ? <ContactLink>{name}</ContactLink> : null;
    },
  },
  {
    id: "email",
    label: "Email",
    width: 240,
    sortValue: (lead) => lead.email,
    cell: (lead) => <LabeledValue value={lead.email} hint="Work" />,
  },
  {
    id: "company",
    label: "Company",
    width: 180,
    sortValue: (lead) => lead.company_name,
    cell: (lead) => (lead.company_name ? <ContactLink>{lead.company_name}</ContactLink> : null),
  },
  {
    id: "phone",
    label: "Phone",
    width: 180,
    sortValue: (lead) => lead.phone,
    cell: (lead) => <LabeledValue value={lead.phone} hint="Work" />,
  },
  {
    id: "owner",
    label: "Owner",
    width: 160,
    sortValue: (lead) => lead.added_by_name,
    cell: (lead) => lead.added_by_name || null,
  },
  {
    id: "created",
    label: "Date Created",
    width: 140,
    sortValue: (lead) => lead.created_at,
    cell: (lead) => formatGridDate(lead.created_at),
  },
  {
    id: "source",
    label: "Source",
    width: 140,
    sortValue: (lead) => lead.source,
    cell: (lead) => contactSourceLabel(lead.source) || null,
  },
  {
    id: "status",
    label: "Status",
    defaultVisible: false,
    width: 130,
    sortValue: (lead) => lead.status,
    cell: (lead) => <span className={statusClass(lead.status)}>{formatStatus(lead.status)}</span>,
  },
  {
    id: "contact_title",
    label: "Title",
    defaultVisible: false,
    width: 160,
    sortValue: (lead) => lead.contact_title,
    cell: (lead) => lead.contact_title || null,
  },
  {
    id: "city",
    label: "City",
    defaultVisible: false,
    width: 140,
    sortValue: (lead) => lead.city,
    cell: (lead) => lead.city || null,
  },
  {
    id: "state",
    label: "State",
    defaultVisible: false,
    width: 100,
    sortValue: (lead) => lead.state,
    cell: (lead) => lead.state || null,
  },
  {
    id: "country",
    label: "Country",
    defaultVisible: false,
    width: 120,
    sortValue: (lead) => lead.country,
    cell: (lead) => lead.country || null,
  },
  {
    id: "website",
    label: "Website",
    defaultVisible: false,
    width: 180,
    sortValue: (lead) => lead.website,
    cell: (lead) => lead.website || null,
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
    id: "tags",
    label: "Tags",
    defaultVisible: false,
    width: 160,
    sortValue: (lead) => lead.tags?.join(", "),
    cell: (lead) => (lead.tags?.length ? lead.tags.join(", ") : null),
  },
  {
    id: "updated",
    label: "Updated",
    defaultVisible: false,
    width: 180,
    sortValue: (lead) => lead.updated_at,
    cell: (lead) => formatGridDateTime(lead.updated_at),
  },
];

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const openedFromQueryRef = useRef<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
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
    const [leadsPayload, companiesPayload] = await Promise.all([
      fetchJson<{ leads: Lead[] }>(`/api/leads?${params.toString()}`),
      fetchJson<{ companies: CompanyOption[] }>("/api/companies?limit=200"),
    ]);
    if (!leadsPayload) {
      return;
    }
    setLeads(leadsPayload.leads);
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

  const selected = leads.find((lead) => lead.id === selectedId);
  const linkedCompany = companies.find((company) => company.id === editor.company_id);
  const contactDisplayName = `${editor.first_name} ${editor.last_name}`.trim();

  function openLead(lead: Lead) {
    setSelectedId(lead.id);
    setEditor({
      title: lead.title,
      status: lead.status,
      source: lead.source ?? "",
      value: lead.value_minor != null ? String(lead.value_minor / 100) : "",
      person_id: lead.person_id ?? "",
      company_id: lead.company_id ?? "",
      company_name: lead.company_name ?? "",
      first_name: lead.first_name ?? "",
      last_name: lead.last_name ?? "",
      email: lead.email ?? "",
      phone: lead.phone ?? "",
      contact_title: lead.contact_title ?? "",
      address_line_1: lead.address_line_1 ?? "",
      city: lead.city ?? "",
      state: lead.state ?? "",
      postal_code: lead.postal_code ?? "",
      website: lead.website ?? "",
      notes: lead.notes ?? "",
    });
    setStatus("");
    setError("");
    setDrawerOpen(true);
  }

  useEffect(() => {
    const openId = searchParams.get("open");
    if (!openId || openedFromQueryRef.current === openId || leads.length === 0) {
      return;
    }
    const lead = leads.find((item) => item.id === openId);
    if (!lead) {
      return;
    }
    openedFromQueryRef.current = openId;
    openLead(lead);
  }, [leads, searchParams]);

  function openNew() {
    setSelectedId("");
    setEditor(emptyEditor());
    setStatus("");
    setError("");
    setDrawerOpen(true);
  }

  function leadPayloadFromEditor(current: Editor): Record<string, unknown> {
    const company = companies.find((item) => item.id === current.company_id);
    return {
      title: current.title,
      status: current.status,
      source: current.source || null,
      value_minor: dollarsToMinor(current.value),
      person_id: current.person_id || null,
      company_id: current.company_id || null,
      company_name: (company?.name ?? current.company_name) || null,
      first_name: current.first_name,
      last_name: current.last_name,
      email: current.email,
      phone: current.phone,
      contact_title: current.contact_title || undefined,
      address_line_1: current.address_line_1 || undefined,
      city: current.city || undefined,
      state: current.state || undefined,
      postal_code: current.postal_code || undefined,
      website: current.website ? normalizeWebsite(current.website) : undefined,
      notes: current.notes || undefined,
    };
  }

  function validateLeadForSave(current: Editor): string | null {
    return leadContactDetailsError({
      first_name: current.first_name,
      last_name: current.last_name,
      email: current.email,
      phone: current.phone,
      contact_title: current.contact_title,
      website: current.website,
    });
  }

  async function saveLeadRecord() {
    const validationError = validateLeadForSave(editor);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    setStatus("");
    const payload = leadPayloadFromEditor(editor);
    try {
      if (selectedId) {
        const response = await fetch(`/api/leads/${selectedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
          setError(body?.error?.message ?? "Failed to save lead");
          return;
        }
        setStatus("Saved.");
        await load();
        setDrawerOpen(false);
        setError("");
        setStatus("");
        return;
      }
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(body?.error?.message ?? "Failed to save lead");
        return;
      }
      const body = (await response.json()) as { lead: Lead };
      setSelectedId(body.lead.id);
      await load();
      setDrawerOpen(false);
      setError("");
      setStatus("");
    } finally {
      setSaving(false);
    }
  }

  async function convertLeadToContact() {
    if (!selectedId) {
      setError("Save the lead before converting to a contact.");
      return;
    }
    if (editor.status === "CONVERTED") {
      setError("This lead was already converted to a contact.");
      return;
    }
    const validationError = validateLeadForSave(editor);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError("");
    setStatus("");
    try {
      // Persist latest edits before conversion so People gets current field values.
      const patchResponse = await fetch(`/api/leads/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leadPayloadFromEditor(editor)),
      });
      if (!patchResponse.ok) {
        const body = (await patchResponse.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(body?.error?.message ?? "Failed to save lead before conversion");
        return;
      }

      const response = await fetch(`/api/leads/${selectedId}/convert`, {
        method: "POST",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(body?.error?.message ?? "Failed to convert lead");
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

  const saveLead = useCallback(
    async (body: Record<string, unknown>) => {
    setError("");
    setStatus("");
    if (selectedId) {
      const detailsError = leadContactDetailsError({
        first_name: typeof body.first_name === "string" ? body.first_name : editor.first_name,
        last_name: typeof body.last_name === "string" ? body.last_name : editor.last_name,
        email: typeof body.email === "string" ? body.email : editor.email,
        phone: typeof body.phone === "string" ? body.phone : editor.phone,
        contact_title: typeof body.contact_title === "string" ? body.contact_title : editor.contact_title,
        website: typeof body.website === "string" ? body.website : editor.website,
      });
      if (detailsError) {
        setError(detailsError);
        return;
      }
      const response = await fetch(`/api/leads/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
        setError(payload?.error?.message ?? "Failed to save lead");
        return;
      }
      setStatus("Saved.");
      await load();
      return;
    }

    const merged = {
      ...editor,
      ...(typeof body.title === "string" ? { title: body.title } : {}),
      ...(typeof body.status === "string" ? { status: body.status as LeadStatus } : {}),
      ...(typeof body.source === "string" ? { source: body.source } : {}),
      ...(body.value_minor !== undefined
        ? {
            value:
              body.value_minor === null
                ? ""
                : String((body.value_minor as number) / 100),
          }
        : {}),
      ...(body.person_id !== undefined
        ? { person_id: typeof body.person_id === "string" ? body.person_id : "" }
        : {}),
      ...(body.company_id !== undefined
        ? { company_id: typeof body.company_id === "string" ? body.company_id : "" }
        : {}),
      ...(typeof body.first_name === "string" ? { first_name: body.first_name } : {}),
      ...(typeof body.last_name === "string" ? { last_name: body.last_name } : {}),
      ...(typeof body.email === "string" ? { email: body.email } : {}),
      ...(typeof body.phone === "string" ? { phone: body.phone } : {}),
      ...(typeof body.contact_title === "string" ? { contact_title: body.contact_title } : {}),
      ...(typeof body.address_line_1 === "string" ? { address_line_1: body.address_line_1 } : {}),
      ...(typeof body.city === "string" ? { city: body.city } : {}),
      ...(typeof body.state === "string" ? { state: body.state } : {}),
      ...(typeof body.postal_code === "string" ? { postal_code: body.postal_code } : {}),
      ...(typeof body.website === "string" ? { website: normalizeWebsite(body.website) } : {}),
      ...(typeof body.notes === "string" ? { notes: body.notes } : {}),
      ...(typeof body.company_name === "string" ? { company_name: body.company_name } : {}),
    };

    const detailsError = leadContactDetailsError({
      first_name: merged.first_name,
      last_name: merged.last_name,
      email: merged.email,
      phone: merged.phone,
      contact_title: merged.contact_title,
      website: merged.website,
    });
    if (detailsError) {
      setError(detailsError);
      return;
    }

    const response = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: merged.title,
        status: merged.status,
        source: merged.source || undefined,
        value_minor: dollarsToMinor(merged.value),
        person_id: merged.person_id || null,
        company_id: merged.company_id || null,
        company_name:
          companies.find((company) => company.id === merged.company_id)?.name ||
          merged.company_name ||
          undefined,
        first_name: merged.first_name || undefined,
        last_name: merged.last_name || undefined,
        email: merged.email || undefined,
        phone: merged.phone || undefined,
        contact_title: merged.contact_title || undefined,
        address_line_1: merged.address_line_1 || undefined,
        city: merged.city || undefined,
        state: merged.state || undefined,
        postal_code: merged.postal_code || undefined,
        website: merged.website || undefined,
        notes: merged.notes || undefined,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(payload?.error?.message ?? "Failed to save lead");
      return;
    }
    const payload = (await response.json()) as { lead: Lead };
    setSelectedId(payload.lead.id);
    setStatus("Saved.");
    await load();
    },
    [selectedId, editor, companies, load],
  );

  const ensureCompanyOption = useCallback((company: CompanySearchResult) => {
    setCompanies((current) =>
      current.some((item) => item.id === company.id) ? current : [...current, company],
    );
  }, []);

  const commitCompanyAssociation = useCallback(
    async (name: string, companyId: string) => {
      const resolved = await resolveCompanyAssociation(name, companyId);
      if (resolved.company) {
        ensureCompanyOption(resolved.company);
      }
      setEditor((current) => ({
        ...current,
        company_id: resolved.company_id ?? "",
        company_name: resolved.company_name ?? "",
      }));
      void saveLead({
        company_id: resolved.company_id,
        company_name: resolved.company_name,
      });
    },
    [ensureCompanyOption, saveLead],
  );

  const commitAddress = useCallback(
    (address: AddressValues) => {
      setEditor((current) => ({
        ...current,
        address_line_1: address.address_line_1,
        city: address.city,
        state: address.state,
        postal_code: address.postal_code,
      }));
      void saveLead({
        address_line_1: address.address_line_1 || null,
        city: address.city || null,
        state: address.state || null,
        postal_code: address.postal_code || null,
      });
    },
    [saveLead],
  );

  const commitWebsite = useCallback(
    (value: string) => {
      const website = normalizeWebsite(value);
      setEditor((current) => ({ ...current, website }));
      void saveLead({ website: website || null });
    },
    [saveLead],
  );

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
            onCommit: (value) => void saveLead({ first_name: value }),
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
            onCommit: (value) => void saveLead({ last_name: value }),
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
            onCommit: (value) => void saveLead({ email: value }),
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
            validate: (value) => validatePhone(value, { required: true }),
            onCommit: (value) => void saveLead({ phone: value }),
          },
          {
            id: "contact_title",
            icon: "title",
            label: "Title",
            showLabel: true,
            value: editor.contact_title,
            placeholder: "Title",
            onChange: (value) => setEditor((current) => ({ ...current, contact_title: value })),
            validate: (value) => validateTitle(value),
            onCommit: (value) => void saveLead({ contact_title: value }),
          },
        ],
      },
      {
        id: "company",
        label: "Company",
        fields: [
          {
            id: "company",
            icon: "company",
            label: "Company",
            showLabel: false,
            type: "company-search",
            value: editor.company_name || linkedCompany?.name || "",
            companyId: editor.company_id,
            placeholder: "Company",
            onChange: (value) => setEditor((current) => ({ ...current, company_name: value })),
            onCompanySelect: (company) => {
              if (company) {
                ensureCompanyOption(company);
                setEditor((current) => ({
                  ...current,
                  company_id: company.id,
                  company_name: company.name,
                }));
                return;
              }
              setEditor((current) => ({ ...current, company_id: "" }));
            },
            onCommit: (value) => void commitCompanyAssociation(value, editor.company_id),
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
            id: "lead_title",
            icon: "value",
            label: "Lead title",
            showLabel: true,
            value: editor.title,
            placeholder: "Lead title",
            onChange: (value) => setEditor((current) => ({ ...current, title: value })),
            onCommit: (value) => void saveLead({ title: value }),
          },
          {
            id: "status",
            icon: "status",
            label: "Status",
            showLabel: true,
            type: "select",
            value: editor.status,
            placeholder: "Status",
            options: LEAD_STATUSES.map((item) => ({ value: item, label: formatStatus(item) })),
            onChange: (value) => setEditor((current) => ({ ...current, status: value as LeadStatus })),
            onCommit: (value) => void saveLead({ status: value }),
          },
          {
            id: "value",
            icon: "value",
            label: "Value",
            showLabel: true,
            value: editor.value,
            placeholder: "Value",
            onChange: (value) => setEditor((current) => ({ ...current, value })),
            onCommit: (value) => void saveLead({ value_minor: dollarsToMinor(value) }),
          },
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
            onCommit: (value) => void saveLead({ source: value || null }),
          },
        ],
      },
    ],
    [commitAddress, commitCompanyAssociation, commitWebsite, companies, currentUserName, editor, ensureCompanyOption, linkedCompany, selected, selectedId, saveLead],
  );

  const isNewLead = !selectedId;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <h1 className="sr-only">Leads</h1>
      <CrmDataGrid
        storageKey="crm-grid-leads-v3"
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
        variant="person"
        recordKey={selectedId ? `${selectedId}-${selected?.updated_at ?? ""}` : "new-lead"}
        title={contactDisplayName}
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
          void saveLead(names);
        }}
        onClose={() => {
          setDrawerOpen(false);
          setError("");
        }}
        sections={sections}
        notes={editor.notes}
        onNotesSave={(value) => {
          setEditor((current) => ({ ...current, notes: value }));
          void saveLead({ notes: value });
        }}
        onNotesChange={(value) => setEditor((current) => ({ ...current, notes: value }))}
        crmRecord={
          selectedId
            ? {
                type: "lead",
                id: selectedId,
                links: {
                  leadId: selectedId,
                  leadTitle: editor.title,
                  contactId: editor.person_id || undefined,
                  contactName: contactDisplayName || selected?.person_name || undefined,
                  companyId: editor.company_id || undefined,
                  companyName: linkedCompany?.name || editor.company_name || selected?.company_name || undefined,
                },
              }
            : undefined
        }
        error={drawerOpen ? error : undefined}
        status={status}
        footerSave={{
          label: isNewLead ? "Save lead" : "Save",
          saving,
          onSave: () => void saveLeadRecord(),
          menuActions: selectedId
            ? [
                {
                  id: "convert-to-contact",
                  label: "Convert to Contact",
                  disabled: editor.status === "CONVERTED" || saving,
                  onSelect: () => void convertLeadToContact(),
                },
              ]
            : undefined,
        }}
      />
    </div>
  );
}
