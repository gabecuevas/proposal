import { prisma } from "@repo/db";
import { COMPANY_FIELD_LABELS } from "./field-labels";
import { userDisplayName } from "./display-name";
import { recordFieldChanges, recordRecordCreated } from "./timeline";

export type CompanyRecord = {
  id: string;
  workspace_id: string;
  owner_user_id: string | null;
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  industry: string | null;
  notes: string | null;
  tags: string[];
  people_count: number;
  added_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type CompanyInput = {
  name: string;
  website?: string;
  phone?: string;
  email?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  industry?: string;
  notes?: string;
  tags?: string[];
};

function asTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function parseCompany(
  row: {
    id: string;
    workspace_id: string;
    owner_user_id: string | null;
    name: string;
    website: string | null;
    phone: string | null;
    email: string | null;
    address_line_1: string | null;
    address_line_2: string | null;
    city: string | null;
    state: string | null;
    postal_code: string | null;
    country: string | null;
    industry: string | null;
    notes: string | null;
    tags: unknown;
    created_at: Date;
    updated_at: Date;
    _count?: { people: number };
    owner?: { name: string; email: string } | null;
  },
): CompanyRecord {
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    owner_user_id: row.owner_user_id,
    name: row.name,
    website: row.website,
    phone: row.phone,
    email: row.email,
    address_line_1: row.address_line_1,
    address_line_2: row.address_line_2,
    city: row.city,
    state: row.state,
    postal_code: row.postal_code,
    country: row.country,
    industry: row.industry,
    notes: row.notes,
    tags: asTags(row.tags),
    people_count: row._count?.people ?? 0,
    added_by_name: userDisplayName(row.owner),
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function optionalText(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function companySnapshot(row: {
  name: string;
  website: string | null;
  phone: string | null;
  email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  industry: string | null;
  notes: string | null;
}): Record<string, unknown> {
  return {
    name: row.name,
    website: row.website,
    phone: row.phone,
    email: row.email,
    address_line_1: row.address_line_1,
    address_line_2: row.address_line_2,
    city: row.city,
    state: row.state,
    postal_code: row.postal_code,
    country: row.country,
    industry: row.industry,
    notes: row.notes,
  };
}

const companyInclude = {
  _count: { select: { people: true } },
  owner: { select: { name: true, email: true } },
} as const;

export async function listCompanies(
  workspaceId: string,
  options?: { limit?: number; query?: string },
): Promise<CompanyRecord[]> {
  const query = options?.query?.trim();
  const rows = await prisma.company.findMany({
    where: {
      workspace_id: workspaceId,
      OR: query
        ? [
            { name: { contains: query, mode: "insensitive" } },
            { website: { contains: query, mode: "insensitive" } },
            { industry: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ]
        : undefined,
    },
    include: companyInclude,
    orderBy: [{ updated_at: "desc" }, { id: "desc" }],
    take: options?.limit ?? 50,
  });
  return rows.map(parseCompany);
}

export async function createCompany(
  workspaceId: string,
  ownerUserId: string,
  input: CompanyInput,
): Promise<CompanyRecord> {
  const row = await prisma.company.create({
    data: {
      workspace_id: workspaceId,
      owner_user_id: ownerUserId,
      name: input.name.trim(),
      website: optionalText(input.website),
      phone: optionalText(input.phone),
      email: optionalText(input.email)?.toLowerCase() ?? null,
      address_line_1: optionalText(input.address_line_1),
      address_line_2: optionalText(input.address_line_2),
      city: optionalText(input.city),
      state: optionalText(input.state),
      postal_code: optionalText(input.postal_code),
      country: optionalText(input.country),
      industry: optionalText(input.industry),
      notes: optionalText(input.notes),
      tags: input.tags ?? [],
    },
    include: companyInclude,
  });
  await recordRecordCreated({
    workspaceId,
    actorUserId: ownerUserId,
    record: { companyId: row.id },
    summary: "Company created",
  });
  return parseCompany(row);
}

export async function updateCompany(
  companyId: string,
  workspaceId: string,
  input: Partial<CompanyInput>,
  context?: { actorUserId?: string },
): Promise<CompanyRecord | null> {
  const existing = await prisma.company.findFirst({
    where: { id: companyId, workspace_id: workspaceId },
  });
  if (!existing) {
    return null;
  }
  const row = await prisma.company.update({
    where: { id: companyId },
    data: {
      name: input.name?.trim() ?? existing.name,
      website: input.website !== undefined ? optionalText(input.website) : existing.website,
      phone: input.phone !== undefined ? optionalText(input.phone) : existing.phone,
      email: input.email !== undefined ? optionalText(input.email)?.toLowerCase() ?? null : existing.email,
      address_line_1:
        input.address_line_1 !== undefined ? optionalText(input.address_line_1) : existing.address_line_1,
      address_line_2:
        input.address_line_2 !== undefined ? optionalText(input.address_line_2) : existing.address_line_2,
      city: input.city !== undefined ? optionalText(input.city) : existing.city,
      state: input.state !== undefined ? optionalText(input.state) : existing.state,
      postal_code: input.postal_code !== undefined ? optionalText(input.postal_code) : existing.postal_code,
      country: input.country !== undefined ? optionalText(input.country) : existing.country,
      industry: input.industry !== undefined ? optionalText(input.industry) : existing.industry,
      notes: input.notes !== undefined ? optionalText(input.notes) : existing.notes,
      tags: input.tags ?? (Array.isArray(existing.tags) ? existing.tags : []),
    },
    include: companyInclude,
  });

  if (context?.actorUserId) {
    await recordFieldChanges({
      workspaceId,
      actorUserId: context.actorUserId,
      record: { companyId },
      before: companySnapshot(existing),
      after: companySnapshot(row),
      labels: COMPANY_FIELD_LABELS,
    });
  }

  return parseCompany(row);
}

export async function countCompanies(workspaceId: string): Promise<number> {
  return prisma.company.count({ where: { workspace_id: workspaceId } });
}
