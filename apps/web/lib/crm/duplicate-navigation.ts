import type { DuplicateMatch } from "./duplicate-search";

type DuplicateOpenHandlers = {
  openContact?: (id: string) => void | Promise<void>;
  openCompany?: (id: string) => void | Promise<void>;
  openLead?: (id: string) => void | Promise<void>;
};

export function openDuplicateMatch(match: DuplicateMatch, handlers: DuplicateOpenHandlers): void {
  if (match.entity === "contact") {
    void handlers.openContact?.(match.id);
    return;
  }
  if (match.entity === "company") {
    void handlers.openCompany?.(match.id);
    return;
  }
  void handlers.openLead?.(match.id);
}

export async function findContactInList(id: string): Promise<{
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
  website: string | null;
  notes: string | null;
  source: string | null;
  added_by_name: string | null;
  created_at: string;
  updated_at: string;
} | null> {
  const response = await fetch("/api/contacts?limit=200");
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as {
    contacts: Array<{
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
      website: string | null;
      notes: string | null;
      source: string | null;
      added_by_name: string | null;
      created_at: string;
      updated_at: string;
    }>;
  };
  return payload.contacts.find((contact) => contact.id === id) ?? null;
}

export async function findCompanyInList(id: string): Promise<{
  id: string;
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  industry: string | null;
  city: string | null;
  notes: string | null;
  people_count: number;
  created_at: string;
  updated_at: string;
} | null> {
  const response = await fetch("/api/companies?limit=200");
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as {
    companies: Array<{
      id: string;
      name: string;
      website: string | null;
      phone: string | null;
      email: string | null;
      industry: string | null;
      city: string | null;
      notes: string | null;
      people_count: number;
      created_at: string;
      updated_at: string;
    }>;
  };
  return payload.companies.find((company) => company.id === id) ?? null;
}

export async function findLeadInList(id: string): Promise<{
  id: string;
  title: string;
  status: string;
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
  added_by_name: string | null;
  created_at: string;
  updated_at: string;
} | null> {
  const response = await fetch("/api/leads?limit=200");
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as {
    leads: Array<{
      id: string;
      title: string;
      status: string;
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
      added_by_name: string | null;
      created_at: string;
      updated_at: string;
    }>;
  };
  return payload.leads.find((lead) => lead.id === id) ?? null;
}
