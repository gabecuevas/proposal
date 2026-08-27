import { prisma } from "@repo/db";
import { LEAD_STATUSES, type LeadStatus } from "./lead-status";

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
  email: string | null;
  phone: string | null;
  notes: string | null;
  person_name: string | null;
  company_name: string | null;
  created_at: string;
  updated_at: string;
};

type LeadInput = {
  title: string;
  status?: LeadStatus;
  source?: string;
  value_minor?: number | null;
  currency?: string;
  person_id?: string | null;
  company_id?: string | null;
  email?: string;
  phone?: string;
  notes?: string;
};

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
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
  person?: { full_name: string } | null;
  company?: { name: string } | null;
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
    email: row.email,
    phone: row.phone,
    notes: row.notes,
    person_name: row.person?.full_name ?? null,
    company_name: row.company?.name ?? null,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString(),
  };
}

function optionalText(value: string | undefined | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const leadInclude = {
  person: { select: { full_name: true } },
  company: { select: { name: true } },
} as const;

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
            { email: { contains: query, mode: "insensitive" } },
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
  const row = await prisma.lead.create({
    data: {
      workspace_id: workspaceId,
      owner_user_id: ownerUserId,
      title: input.title.trim(),
      status: input.status ?? "NEW",
      source: optionalText(input.source),
      value_minor: input.value_minor ?? null,
      currency: input.currency?.trim() || "USD",
      person_id: input.person_id || null,
      company_id: input.company_id || null,
      email: optionalText(input.email)?.toLowerCase() ?? null,
      phone: optionalText(input.phone),
      notes: optionalText(input.notes),
    },
    include: leadInclude,
  });
  return parseLead(row);
}

export async function updateLead(
  leadId: string,
  workspaceId: string,
  input: Partial<LeadInput>,
): Promise<LeadRecord | null> {
  const existing = await prisma.lead.findFirst({
    where: { id: leadId, workspace_id: workspaceId },
  });
  if (!existing) {
    return null;
  }
  const row = await prisma.lead.update({
    where: { id: leadId },
    data: {
      title: input.title?.trim() ?? existing.title,
      status: input.status ?? existing.status,
      source: input.source !== undefined ? optionalText(input.source) : existing.source,
      value_minor: input.value_minor !== undefined ? input.value_minor : existing.value_minor,
      currency: input.currency?.trim() || existing.currency,
      person_id: input.person_id !== undefined ? input.person_id || null : existing.person_id,
      company_id: input.company_id !== undefined ? input.company_id || null : existing.company_id,
      email: input.email !== undefined ? optionalText(input.email)?.toLowerCase() ?? null : existing.email,
      phone: input.phone !== undefined ? optionalText(input.phone) : existing.phone,
      notes: input.notes !== undefined ? optionalText(input.notes) : existing.notes,
    },
    include: leadInclude,
  });
  return parseLead(row);
}

export async function countLeads(workspaceId: string): Promise<number> {
  return prisma.lead.count({ where: { workspace_id: workspaceId } });
}
