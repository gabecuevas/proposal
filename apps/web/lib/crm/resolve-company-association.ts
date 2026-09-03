export type CompanySearchResult = {
  id: string;
  name: string;
  website?: string | null;
  city?: string | null;
  industry?: string | null;
};

export async function searchCompanies(query: string, limit = 8): Promise<CompanySearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  const params = new URLSearchParams({ q: trimmed, limit: String(limit) });
  const response = await fetch(`/api/companies?${params.toString()}`);
  if (!response.ok) {
    return [];
  }
  const payload = (await response.json()) as { companies?: CompanySearchResult[] };
  return payload.companies ?? [];
}

export async function resolveCompanyAssociation(
  name: string,
  companyId: string,
): Promise<{ company_id: string | null; company_name: string | null; company?: CompanySearchResult }> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { company_id: null, company_name: null };
  }

  if (companyId) {
    return { company_id: companyId, company_name: trimmed };
  }

  const matches = await searchCompanies(trimmed, 20);
  const exact = matches.find((company) => company.name.toLowerCase() === trimmed.toLowerCase());
  if (exact) {
    return { company_id: exact.id, company_name: exact.name, company: exact };
  }

  const createResponse = await fetch("/api/companies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: trimmed }),
  });
  if (createResponse.ok) {
    const payload = (await createResponse.json()) as { company?: CompanySearchResult };
    if (payload.company) {
      return {
        company_id: payload.company.id,
        company_name: payload.company.name,
        company: payload.company,
      };
    }
  }

  return { company_id: null, company_name: trimmed };
}
