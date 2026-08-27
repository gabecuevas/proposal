export type CrmVariableKey = {
  key: string;
  label: string;
  sample?: string;
};

export const CLIENT_VARIABLES: CrmVariableKey[] = [
  { key: "Client.FirstName", label: "First name" },
  { key: "Client.LastName", label: "Last name" },
  { key: "Client.FullName", label: "Full name" },
  { key: "Client.Email", label: "Email" },
  { key: "Client.Phone", label: "Phone" },
  { key: "Client.Title", label: "Title" },
  { key: "Client.City", label: "City" },
];

export const COMPANY_VARIABLES: CrmVariableKey[] = [
  { key: "Company.Name", label: "Company name" },
  { key: "Company.Website", label: "Website" },
  { key: "Company.Phone", label: "Phone" },
  { key: "Company.Email", label: "Email" },
  { key: "Company.Industry", label: "Industry" },
  { key: "Company.City", label: "City" },
  { key: "Company.Address", label: "Address" },
];

type PersonLike = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  city?: string | null;
  company_name?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

type CompanyLike = {
  name?: string | null;
  website?: string | null;
  phone?: string | null;
  email?: string | null;
  industry?: string | null;
  city?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

function companyAddress(company: CompanyLike | null | undefined): string {
  if (!company) {
    return "";
  }
  return [
    company.address_line_1,
    company.address_line_2,
    [company.city, company.state, company.postal_code].filter(Boolean).join(" "),
    company.country,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Values inserted into a document when a CRM person/company is linked. */
export function crmToDocumentVariables(
  person?: PersonLike | null,
  company?: CompanyLike | null,
): Record<string, Record<string, string>> {
  const companyName = company?.name || person?.company_name || "";
  return {
    Client: {
      FirstName: person?.first_name ?? "",
      LastName: person?.last_name ?? "",
      FullName: person?.full_name ?? "",
      Email: person?.email ?? "",
      Phone: person?.phone ?? "",
      Title: person?.title ?? "",
      City: person?.city ?? "",
      Company: companyName,
    },
    Company: {
      Name: companyName,
      Website: company?.website ?? "",
      Phone: company?.phone ?? "",
      Email: company?.email ?? "",
      Industry: company?.industry ?? "",
      City: company?.city ?? "",
      Address: companyAddress(company),
    },
  };
}
