import { prisma } from "@repo/db";
import type { InputJsonValue } from "@repo/db";

export type ContactRecord = {
  id: string;
  workspace_id: string;
  owner_user_id: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  title: string | null;
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
  created_at: string;
  updated_at: string;
};

type ContactRow = {
  id: string;
  workspace_id: string;
  owner_user_id: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string | null;
  company_name: string | null;
  title: string | null;
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
};

function parseContact(row: ContactRow): ContactRecord {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    owner_user_id: row.owner_user_id,
    first_name: row.first_name,
    last_name: row.last_name,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    company_name: row.company_name,
    title: row.title,
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
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function toFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export async function listContacts(
  workspaceId: string,
  options?: { limit?: number; before?: Date; query?: string; tag?: string },
): Promise<ContactRecord[]> {
  const query = options?.query?.trim();
  const tag = options?.tag?.trim();
  const rows = await prisma.contact.findMany({
    where: {
      workspace_id: workspaceId,
      updated_at: options?.before ? { lt: options.before } : undefined,
      OR: query
        ? [
            { full_name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { company_name: { contains: query, mode: "insensitive" } },
          ]
        : undefined,
      tags: tag ? { array_contains: [tag] } : undefined,
    },
    orderBy: [{ updated_at: "desc" }, { id: "desc" }],
    take: options?.limit ?? 50,
  });
  return rows.map((row) => parseContact(row as ContactRow));
}

export async function createContact(input: {
  workspaceId: string;
  ownerUserId: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  company_name?: string;
  title?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  website?: string;
  notes?: string;
  custom_fields_json?: Record<string, unknown>;
  tags?: string[];
  color_label?: string;
}): Promise<ContactRecord> {
  const firstName = input.first_name.trim();
  const lastName = input.last_name.trim();
  const email = input.email.trim().toLowerCase();
  const row = await prisma.contact.create({
    data: {
      workspace_id: input.workspaceId,
      owner_user_id: input.ownerUserId,
      first_name: firstName,
      last_name: lastName,
      full_name: toFullName(firstName, lastName),
      email,
      phone: input.phone?.trim() || null,
      company_name: input.company_name?.trim() || null,
      title: input.title?.trim() || null,
      address_line_1: input.address_line_1?.trim() || null,
      address_line_2: input.address_line_2?.trim() || null,
      city: input.city?.trim() || null,
      state: input.state?.trim() || null,
      postal_code: input.postal_code?.trim() || null,
      country: input.country?.trim() || null,
      website: input.website?.trim() || null,
      notes: input.notes?.trim() || null,
      custom_fields_json: (input.custom_fields_json ?? {}) as InputJsonValue,
      tags: input.tags ?? [],
      color_label: input.color_label?.trim() || null,
      last_activity_at: null,
    },
  });
  return parseContact(row as ContactRow);
}

export async function updateContact(
  contactId: string,
  workspaceId: string,
  input: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    company_name?: string;
    title?: string;
    address_line_1?: string;
    address_line_2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
    website?: string;
    notes?: string;
    custom_fields_json?: Record<string, unknown>;
    tags?: string[];
    color_label?: string;
  },
): Promise<ContactRecord | null> {
  const existing = await prisma.contact.findFirst({
    where: { id: contactId, workspace_id: workspaceId },
  });
  if (!existing) {
    return null;
  }

  const nextFirstName = input.first_name?.trim() ?? existing.first_name;
  const nextLastName = input.last_name?.trim() ?? existing.last_name;
  const row = await prisma.contact.update({
    where: { id: contactId },
    data: {
      first_name: nextFirstName,
      last_name: nextLastName,
      full_name: toFullName(nextFirstName, nextLastName),
      email: input.email?.trim().toLowerCase() ?? existing.email,
      phone: input.phone !== undefined ? input.phone.trim() || null : existing.phone,
      company_name:
        input.company_name !== undefined ? input.company_name.trim() || null : existing.company_name,
      title: input.title !== undefined ? input.title.trim() || null : existing.title,
      address_line_1:
        input.address_line_1 !== undefined ? input.address_line_1.trim() || null : existing.address_line_1,
      address_line_2:
        input.address_line_2 !== undefined ? input.address_line_2.trim() || null : existing.address_line_2,
      city: input.city !== undefined ? input.city.trim() || null : existing.city,
      state: input.state !== undefined ? input.state.trim() || null : existing.state,
      postal_code: input.postal_code !== undefined ? input.postal_code.trim() || null : existing.postal_code,
      country: input.country !== undefined ? input.country.trim() || null : existing.country,
      website: input.website !== undefined ? input.website.trim() || null : existing.website,
      notes: input.notes !== undefined ? input.notes.trim() || null : existing.notes,
      custom_fields_json: (input.custom_fields_json ??
        ((existing.custom_fields_json as InputJsonValue | null) ?? {})) as InputJsonValue,
      tags: input.tags ?? (Array.isArray(existing.tags) ? existing.tags : []),
      color_label:
        input.color_label !== undefined ? input.color_label.trim() || null : existing.color_label,
    },
  });
  return parseContact(row as ContactRow);
}
