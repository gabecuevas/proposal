import { prisma, type InputJsonValue } from "@repo/db";
import { leadContactDetailsError } from "./contact-field-validation";
import { LEAD_STATUSES, type LeadStatus } from "./lead-status";
import { LEAD_FIELD_LABELS } from "./field-labels";
import { userDisplayName } from "./display-name";
import { recordFieldChanges, recordRecordCreated } from "./timeline";

export { LEAD_STATUSES, type LeadStatus };

export type LeadRecord = {
  id: string;
  workspace_id: string;
  owner_user_id: string | null;
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
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  website: string | null;
  notes: string | null;
  custom_fields_json: Record<string, unknown>;
  tags: string[];
  color_label: string | null;
  last_activity_at: string | null;
  person_name: string | null;
  added_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type LeadInput = {
  title?: string;
  status?: LeadStatus;
  source?: string | null;
  value_minor?: number | null;
  currency?: string;
  person_id?: string | null;
  company_id?: string | null;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company_name?: string | null;
  contact_title?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  website?: string | null;
  notes?: string;
  custom_fields_json?: Record<string, unknown>;
  tags?: string[];
  color_label?: string | null;
};

function toFullName(firstName: string | null | undefined, lastName: string | null | undefined): string | null {
  const full = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  return full || null;
}

function parseLead(row: {
  id: string;
  workspace_id: string;
  owner_user_id: string | null;
  title: string;
  status: string;
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
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  website: string | null;
  notes: string | null;
  custom_fields_json: unknown;
  tags: unknown;
  color_label: string | null;
  last_activity_at: Date | null;
  created_at: Date;
  updated_at: Date;
  person?: { full_name: string } | null;
  company?: { name: string } | null;
  owner?: { name: string; email: string } | null;
}): LeadRecord {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    owner_user_id: row.owner_user_id,
    title: row.title,
    status: LEAD_STATUSES.includes(row.status as LeadStatus) ? (row.status as LeadStatus) : "NEW",
    source: row.source,
    value_minor: row.value_minor,
    currency: row.currency,
    person_id: row.person_id,
    company_id: row.company_id,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    company_name: row.company?.name ?? row.company_name ?? null,
    contact_title: row.contact_title,
    address_line_1: row.address_line_1,
    address_line_2: row.address_line_2,
    city: row.city,
    state: row.state,
    postal_code: row.postal_code,
    country: row.country,
    website: row.website,
    notes: row.notes,
    custom_fields_json:
      row.custom_fields_json && typeof row.custom_fields_json === "object"
        ? (row.custom_fields_json as Record<string, unknown>)
        : {},
    tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
    color_label: row.color_label,
    last_activity_at: row.last_activity_at?.toISOString() ?? null,
    person_name: row.person?.full_name ?? row.full_name ?? null,
    added_by_name: userDisplayName(row.owner),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function optionalText(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export class LeadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeadValidationError";
  }
}

function assertLeadContactDetails(data: {
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  contact_title?: string | null;
  website?: string | null;
}) {
  const message = leadContactDetailsError({
    first_name: data.first_name ?? "",
    last_name: data.last_name ?? "",
    email: data.email ?? "",
    phone: data.phone ?? "",
    contact_title: data.contact_title,
    website: data.website,
  });
  if (message) {
    throw new LeadValidationError(message);
  }
}

function leadSnapshot(row: {
  title: string;
  status: string;
  source: string | null;
  value_minor: number | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  person_id: string | null;
  company_id: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  contact_title: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  website: string | null;
  person?: { full_name: string } | null;
  company?: { name: string } | null;
}): Record<string, unknown> {
  return {
    title: row.title,
    status: row.status,
    source: row.source,
    value_minor: row.value_minor != null ? String(row.value_minor / 100) : "",
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    person_id: row.person?.full_name ?? row.person_id ?? "",
    company_id: row.company?.name ?? row.company_id ?? "",
    first_name: row.first_name,
    last_name: row.last_name,
    company_name: row.company?.name ?? row.company_name,
    contact_title: row.contact_title,
    address_line_1: row.address_line_1,
    address_line_2: row.address_line_2,
    city: row.city,
    state: row.state,
    postal_code: row.postal_code,
    country: row.country,
    website: row.website,
  };
}

const leadInclude = {
  person: { select: { full_name: true } },
  company: { select: { name: true } },
  owner: { select: { name: true, email: true } },
} as const;

function buildLeadData(
  input: Partial<LeadInput>,
  existing?: {
    title: string;
    status: string;
    source: string | null;
    value_minor: number | null;
    currency: string;
    person_id: string | null;
    company_id: string | null;
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    company_name: string | null;
    contact_title: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    website: string | null;
    notes: string | null;
    custom_fields_json: unknown;
    tags: unknown;
    color_label: string | null;
  },
) {
  const firstName =
    input.first_name !== undefined ? optionalText(input.first_name) : (existing?.first_name ?? null);
  const lastName =
    input.last_name !== undefined ? optionalText(input.last_name) : (existing?.last_name ?? null);
  return {
    title: input.title?.trim() ?? existing?.title ?? "",
    status: (input.status ?? existing?.status ?? "NEW") as LeadStatus,
    source: input.source !== undefined ? optionalText(input.source) : (existing?.source ?? null),
    value_minor: input.value_minor !== undefined ? input.value_minor : (existing?.value_minor ?? null),
    currency: input.currency?.trim() || existing?.currency || "USD",
    person_id: input.person_id !== undefined ? input.person_id || null : (existing?.person_id ?? null),
    company_id: input.company_id !== undefined ? input.company_id || null : (existing?.company_id ?? null),
    first_name: firstName,
    last_name: lastName,
    full_name: toFullName(firstName, lastName),
    email:
      input.email !== undefined
        ? optionalText(input.email)?.toLowerCase() ?? null
        : (existing?.email?.toLowerCase() ?? null),
    phone: input.phone !== undefined ? optionalText(input.phone) : (existing?.phone ?? null),
    company_name:
      input.company_name !== undefined ? optionalText(input.company_name) : (existing?.company_name ?? null),
    contact_title:
      input.contact_title !== undefined ? optionalText(input.contact_title) : (existing?.contact_title ?? null),
    address_line_1:
      input.address_line_1 !== undefined ? optionalText(input.address_line_1) : (existing?.address_line_1 ?? null),
    address_line_2:
      input.address_line_2 !== undefined ? optionalText(input.address_line_2) : (existing?.address_line_2 ?? null),
    city: input.city !== undefined ? optionalText(input.city) : (existing?.city ?? null),
    state: input.state !== undefined ? optionalText(input.state) : (existing?.state ?? null),
    postal_code:
      input.postal_code !== undefined ? optionalText(input.postal_code) : (existing?.postal_code ?? null),
    country: input.country !== undefined ? optionalText(input.country) : (existing?.country ?? null),
    website: input.website !== undefined ? optionalText(input.website) : (existing?.website ?? null),
    notes: input.notes !== undefined ? optionalText(input.notes) : (existing?.notes ?? null),
    custom_fields_json: (input.custom_fields_json ??
      ((existing?.custom_fields_json as InputJsonValue | null) ?? {})) as InputJsonValue,
    tags: (input.tags ?? (Array.isArray(existing?.tags) ? existing.tags : [])) as InputJsonValue,
    color_label:
      input.color_label !== undefined ? optionalText(input.color_label) : (existing?.color_label ?? null),
  };
}

export async function listLeads(
  workspaceId: string,
  options?: { limit?: number; query?: string; status?: LeadStatus },
): Promise<LeadRecord[]> {
  const query = options?.query?.trim();
  const rows = await prisma.lead.findMany({
    where: {
      workspace_id: workspaceId,
      status: options?.status,
      OR: query
        ? [
            { title: { contains: query, mode: "insensitive" } },
            { full_name: { contains: query, mode: "insensitive" } },
            { first_name: { contains: query, mode: "insensitive" } },
            { last_name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
            { company_name: { contains: query, mode: "insensitive" } },
            { source: { contains: query, mode: "insensitive" } },
            { person: { full_name: { contains: query, mode: "insensitive" } } },
            { company: { name: { contains: query, mode: "insensitive" } } },
          ]
        : undefined,
    },
    include: leadInclude,
    orderBy: [{ updated_at: "desc" }, { id: "desc" }],
    take: options?.limit ?? 50,
  });
  return rows.map(parseLead);
}

export async function createLead(
  workspaceId: string,
  ownerUserId: string,
  input: LeadInput,
): Promise<LeadRecord> {
  const data = buildLeadData(input);
  assertLeadContactDetails(data);
  const row = await prisma.lead.create({
    data: {
      workspace_id: workspaceId,
      owner_user_id: ownerUserId,
      ...data,
    },
    include: leadInclude,
  });
  await recordRecordCreated({
    workspaceId,
    actorUserId: ownerUserId,
    record: { leadId: row.id },
    summary: "Lead created",
  });
  return parseLead(row);
}

export async function updateLead(
  leadId: string,
  workspaceId: string,
  input: Partial<LeadInput>,
  context?: { actorUserId?: string },
): Promise<LeadRecord | null> {
  const existing = await prisma.lead.findFirst({
    where: { id: leadId, workspace_id: workspaceId },
    include: leadInclude,
  });
  if (!existing) {
    return null;
  }
  const data = buildLeadData(input, existing);
  assertLeadContactDetails(data);
  const row = await prisma.lead.update({
    where: { id: leadId },
    data,
    include: leadInclude,
  });

  if (context?.actorUserId) {
    await recordFieldChanges({
      workspaceId,
      actorUserId: context.actorUserId,
      record: { leadId },
      before: leadSnapshot(existing),
      after: leadSnapshot(row),
      labels: LEAD_FIELD_LABELS,
    });
  }

  return parseLead(row);
}

export async function countLeads(workspaceId: string): Promise<number> {
  return prisma.lead.count({ where: { workspace_id: workspaceId } });
}
