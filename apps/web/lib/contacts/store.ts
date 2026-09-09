import { prisma } from "@repo/db";
import type { InputJsonValue } from "@repo/db";
import { CONTACT_FIELD_LABELS } from "@/lib/crm/field-labels";
import {
  parsePhones,
  phonesToJson,
  primaryPhoneNumber,
  syncPhonesWithScalar,
  formatPhonesHistory,
  type PhoneEntry,
} from "@/lib/crm/phones";
import { recordFieldChanges, recordRecordCreated } from "@/lib/crm/timeline";

export type ContactRecord = {
  id: string;
  workspace_id: string;
  owner_user_id: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone: string | null;
  phones: PhoneEntry[];
  linkedin: string | null;
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
  company_id: string | null;
  source: string | null;
  added_by_name: string | null;
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
  phones?: unknown;
  linkedin?: string | null;
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
  company_id: string | null;
  source: string | null;
  created_at: Date;
  updated_at: Date;
  owner?: { name: string; email: string } | null;
};

function ownerDisplayName(owner: { name: string; email: string } | null | undefined): string | null {
  if (!owner) {
    return null;
  }
  if (owner.name.trim()) {
    return owner.name.trim();
  }
  const local = owner.email.split("@")[0] ?? owner.email;
  const formatted = local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
  return formatted || owner.email;
}

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
    phones: parsePhones(row.phones, row.phone),
    linkedin: row.linkedin ?? null,
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
    company_id: row.company_id,
    source: row.source,
    added_by_name: ownerDisplayName(row.owner),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function contactSnapshot(row: {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  phones?: unknown;
  linkedin?: string | null;
  company_id: string | null;
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
  source: string | null;
  company?: { name: string } | null;
}): Record<string, unknown> {
  return {
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone: row.phone,
    phones: formatPhonesHistory(parsePhones(row.phones, row.phone)),
    linkedin: row.linkedin ?? null,
    company_id: row.company?.name ?? row.company_name ?? row.company_id ?? "",
    company_name: row.company?.name ?? row.company_name,
    title: row.title,
    address_line_1: row.address_line_1,
    address_line_2: row.address_line_2,
    city: row.city,
    state: row.state,
    postal_code: row.postal_code,
    country: row.country,
    website: row.website,
    notes: row.notes,
    source: row.source,
  };
}

function toFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

export class ContactDuplicateError extends Error {
  constructor(message = "Email / Contact already exists") {
    super(message);
    this.name = "ContactDuplicateError";
  }
}

export class ContactActiveDocumentError extends Error {
  constructor(message = "Unable to Delete Contacts with Active Documents") {
    super(message);
    this.name = "ContactActiveDocumentError";
  }
}

/** Statuses in In Progress, Completed, Viewed, Unviewed, or Drafts. */
export const CONTACT_ACTIVE_DOCUMENT_STATUSES = [
  "DRAFTED",
  "SENT",
  "VIEWED",
  "COMMENTED",
  "SIGNED",
  "PAID",
] as const;

function isPrimaryRecipientOnDocument(
  contactId: string,
  doc: { contact_id: string | null; recipients_json: unknown },
): boolean {
  if (doc.contact_id === contactId) {
    return true;
  }
  if (!Array.isArray(doc.recipients_json) || doc.recipients_json.length === 0) {
    return false;
  }
  const recipients = doc.recipients_json.filter(
    (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object",
  );
  const byOrder = recipients.find((item) => Number(item.signing_order) === 1);
  const primary = byOrder ?? recipients[0];
  return primary?.contact_id === contactId || primary?.id === contactId;
}

export async function contactIsPrimaryOnActiveDocument(
  workspaceId: string,
  contactId: string,
): Promise<boolean> {
  const direct = await prisma.document.findFirst({
    where: {
      workspace_id: workspaceId,
      contact_id: contactId,
      status: { in: [...CONTACT_ACTIVE_DOCUMENT_STATUSES] },
    },
    select: { id: true },
  });
  if (direct) {
    return true;
  }

  const candidates = await prisma.document.findMany({
    where: {
      workspace_id: workspaceId,
      status: { in: [...CONTACT_ACTIVE_DOCUMENT_STATUSES] },
    },
    select: { contact_id: true, recipients_json: true },
    take: 1000,
  });
  return candidates.some((doc) => isPrimaryRecipientOnDocument(contactId, doc));
}

export async function findContactByEmail(
  workspaceId: string,
  email: string,
): Promise<{ id: string; full_name: string; email: string } | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  return prisma.contact.findFirst({
    where: { workspace_id: workspaceId, email: normalized },
    select: { id: true, full_name: true, email: true },
  });
}

export async function listContacts(
  workspaceId: string,
  options?: {
    limit?: number;
    before?: Date;
    query?: string;
    tag?: string;
    companyId?: string;
    orderByCreatedAsc?: boolean;
  },
): Promise<ContactRecord[]> {
  const query = options?.query?.trim();
  const tag = options?.tag?.trim();
  const companyId = options?.companyId?.trim();
  const rows = await prisma.contact.findMany({
    where: {
      workspace_id: workspaceId,
      company_id: companyId || undefined,
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
    orderBy: options?.orderByCreatedAsc
      ? [{ created_at: "asc" }, { id: "asc" }]
      : [{ updated_at: "desc" }, { id: "desc" }],
    take: options?.limit ?? 50,
    include: { owner: { select: { name: true, email: true } } },
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
  phones?: PhoneEntry[];
  linkedin?: string;
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
  company_id?: string;
  source?: string;
}): Promise<ContactRecord> {
  const firstName = input.first_name.trim();
  const lastName = input.last_name.trim();
  const email = input.email.trim().toLowerCase();
  const duplicate = await findContactByEmail(input.workspaceId, email);
  if (duplicate) {
    throw new ContactDuplicateError();
  }
  const nextPhones = input.phones
    ? phonesToJson(input.phones)
    : syncPhonesWithScalar(null, input.phone);
  const nextPhone = primaryPhoneNumber(nextPhones);
  const row = await prisma.contact.create({
    data: {
      workspace_id: input.workspaceId,
      owner_user_id: input.ownerUserId,
      first_name: firstName,
      last_name: lastName,
      full_name: toFullName(firstName, lastName),
      email,
      phone: nextPhone,
      phones: nextPhones as InputJsonValue,
      linkedin: input.linkedin?.trim() || null,
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
      company_id: input.company_id?.trim() || null,
      source: input.source?.trim() || null,
      last_activity_at: null,
    },
    include: { owner: { select: { name: true, email: true } } },
  });
  await recordRecordCreated({
    workspaceId: input.workspaceId,
    actorUserId: input.ownerUserId,
    record: { contactId: row.id },
    summary: "Person created",
  });

  const linkedCompanyId = input.company_id?.trim() || null;
  if (linkedCompanyId) {
    try {
      const company = await prisma.company.findFirst({
        where: { id: linkedCompanyId, workspace_id: input.workspaceId },
        select: { id: true, primary_contact_id: true },
      });
      if (company && !company.primary_contact_id) {
        await prisma.company.update({
          where: { id: company.id },
          data: { primary_contact_id: row.id },
        });
      }
    } catch {
      // Person create already succeeded; primary assignment is best-effort.
    }
  }

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
    phones?: PhoneEntry[];
    linkedin?: string;
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
    company_id?: string | null;
    source?: string | null;
  },
  context?: { actorUserId?: string },
): Promise<ContactRecord | null> {
  const existing = await prisma.contact.findFirst({
    where: { id: contactId, workspace_id: workspaceId },
    include: { company: { select: { name: true } } },
  });
  if (!existing) {
    return null;
  }

  const nextFirstName = input.first_name?.trim() ?? existing.first_name;
  const nextLastName = input.last_name?.trim() ?? existing.last_name;
  const nextEmail =
    input.email !== undefined ? input.email.trim().toLowerCase() : existing.email;
  if (nextEmail !== existing.email) {
    const duplicate = await findContactByEmail(workspaceId, nextEmail);
    if (duplicate && duplicate.id !== contactId) {
      throw new ContactDuplicateError();
    }
  }
  const nextPhones = input.phones
    ? phonesToJson(input.phones)
    : input.phone !== undefined
      ? syncPhonesWithScalar(existing.phones, input.phone)
      : parsePhones(existing.phones, existing.phone);
  const nextPhone = primaryPhoneNumber(nextPhones);
  const row = await prisma.contact.update({
    where: { id: contactId },
    data: {
      first_name: nextFirstName,
      last_name: nextLastName,
      full_name: toFullName(nextFirstName, nextLastName),
      email: nextEmail,
      phone: nextPhone,
      phones: nextPhones as InputJsonValue,
      linkedin: input.linkedin !== undefined ? input.linkedin.trim() || null : (existing.linkedin ?? null),
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
      company_id:
        input.company_id !== undefined ? input.company_id?.trim() || null : existing.company_id,
      source:
        input.source !== undefined
          ? (typeof input.source === "string" ? input.source.trim() || null : null)
          : existing.source,
    },
    include: {
      owner: { select: { name: true, email: true } },
      company: { select: { name: true } },
    },
  });

  if (context?.actorUserId) {
    await recordFieldChanges({
      workspaceId,
      actorUserId: context.actorUserId,
      record: { contactId },
      before: contactSnapshot(existing),
      after: contactSnapshot(row),
      labels: CONTACT_FIELD_LABELS,
    });
  }

  return parseContact(row as ContactRow);
}

export async function deleteContact(
  contactId: string,
  workspaceId: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "active_documents" }> {
  const existing = await prisma.contact.findFirst({
    where: { id: contactId, workspace_id: workspaceId },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, reason: "not_found" };
  }
  if (await contactIsPrimaryOnActiveDocument(workspaceId, contactId)) {
    return { ok: false, reason: "active_documents" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.company.updateMany({
      where: { workspace_id: workspaceId, primary_contact_id: contactId },
      data: { primary_contact_id: null },
    });
    await tx.contact.delete({ where: { id: contactId } });
  });
  return { ok: true };
}

export async function countContacts(workspaceId: string): Promise<number> {
  return prisma.contact.count({ where: { workspace_id: workspaceId } });
}
