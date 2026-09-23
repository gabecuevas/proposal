export type CrmVariableKey = {
  key: string;
  label: string;
  sample?: string;
};

export const RECIPIENT_VARIABLES: CrmVariableKey[] = [
  { key: "Recipient.FirstName", label: "First name" },
  { key: "Recipient.LastName", label: "Last name" },
  { key: "Recipient.FullName", label: "Full name" },
  { key: "Recipient.Email", label: "Email" },
  { key: "Recipient.CompanyName", label: "Company name" },
  { key: "Recipient.Phone", label: "Phone" },
  { key: "Recipient.Title", label: "Title" },
];

/** Sender / workspace identity — same `[Sender.*]` bracket format as Quote/Invoice. */
export const SENDER_VARIABLES: CrmVariableKey[] = [
  { key: "Sender.FullName", label: "Full name" },
  { key: "Sender.CompanyName", label: "Company name" },
  { key: "Sender.FullAddress", label: "Full address" },
  { key: "Sender.Phone", label: "Phone" },
  { key: "Sender.Email", label: "Email" },
];

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
  id?: string;
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
  company?: CompanyLike | null;
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

type VariableBag = Record<string, unknown>;

const CRM_NAMESPACES = ["Recipient", "Client", "Company", "Sender"] as const;

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

function personAddress(person: PersonLike): string {
  return [
    person.address_line_1,
    person.address_line_2,
    [person.city, person.state, person.postal_code].filter(Boolean).join(" "),
    person.country,
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
    Recipient: {
      FirstName: person?.first_name ?? "",
      LastName: person?.last_name ?? "",
      FullName: person?.full_name ?? "",
      Email: person?.email ?? "",
      CompanyName: companyName,
      Phone: person?.phone ?? "",
      Title: person?.title ?? "",
    },
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

/**
 * Full variable context from a CRM contact (Recipient/Client/Company + legacy `contact` blob).
 */
export function contactRecordToVariableContext(person: PersonLike): VariableBag {
  const company =
    person.company ??
    (person.company_name
      ? {
          name: person.company_name,
          phone: person.phone,
          city: person.city,
          address_line_1: person.address_line_1,
          address_line_2: person.address_line_2,
          state: person.state,
          postal_code: person.postal_code,
          country: person.country,
        }
      : null);
  const tokens = crmToDocumentVariables(person, company);
  if (!person.id) {
    return tokens;
  }
  const addressFull = personAddress(person);
  return {
    ...tokens,
    contact: {
      id: person.id,
      first_name: person.first_name ?? "",
      last_name: person.last_name ?? "",
      full_name: person.full_name ?? "",
      email: person.email ?? "",
      company_name: company?.name ?? person.company_name ?? "",
      phone: person.phone ?? "",
      address: {
        line_1: person.address_line_1 ?? "",
        line_2: person.address_line_2 ?? "",
        city: person.city ?? "",
        state: person.state ?? "",
        postal_code: person.postal_code ?? "",
        country: person.country ?? "",
        full: addressFull,
      },
    },
  };
}

/** Deep-merge CRM namespaces into an existing variables context (CRM wins on conflict). */
export function mergeCrmVariablesIntoContext(
  existing: VariableBag | null | undefined,
  crm: VariableBag,
): VariableBag {
  const next: VariableBag = { ...(existing ?? {}) };
  for (const ns of CRM_NAMESPACES) {
    const incoming = crm[ns];
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
      continue;
    }
    const prev = next[ns];
    next[ns] = {
      ...(prev && typeof prev === "object" && !Array.isArray(prev) ? (prev as VariableBag) : {}),
      ...(incoming as VariableBag),
    };
  }
  if (crm.contact !== undefined) {
    next.contact = crm.contact;
  }
  return next;
}
