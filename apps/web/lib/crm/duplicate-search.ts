import { prisma } from "@repo/db";
import { normalizePhoneDigits, phoneSearchSuffix, phonesEquivalent } from "./phone-normalize";

export type DuplicateEntity = "contact" | "company" | "lead";
export type DuplicateField = "email" | "phone" | "name";

export type DuplicateMatch = {
  id: string;
  entity: DuplicateEntity;
  name: string;
  company: string | null;
  matchedOn: DuplicateField;
};

type FindDuplicatesOptions = {
  excludeContactId?: string;
  excludeCompanyId?: string;
  excludeLeadId?: string;
  limit?: number;
};

const DEFAULT_LIMIT = 5;

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function addMatch(
  matches: DuplicateMatch[],
  seen: Set<string>,
  match: DuplicateMatch,
  limit: number,
): void {
  const key = `${match.entity}:${match.id}`;
  if (seen.has(key) || matches.length >= limit) {
    return;
  }
  seen.add(key);
  matches.push(match);
}

async function findEmailDuplicates(
  workspaceId: string,
  email: string,
  options: FindDuplicatesOptions,
  limit: number,
): Promise<DuplicateMatch[]> {
  const matches: DuplicateMatch[] = [];
  const seen = new Set<string>();

  const [contacts, companies, leads] = await Promise.all([
    prisma.contact.findMany({
      where: {
        workspace_id: workspaceId,
        email: { equals: email, mode: "insensitive" },
        ...(options.excludeContactId ? { id: { not: options.excludeContactId } } : {}),
      },
      select: { id: true, full_name: true, company_name: true },
      take: limit,
    }),
    prisma.company.findMany({
      where: {
        workspace_id: workspaceId,
        email: { equals: email, mode: "insensitive" },
        ...(options.excludeCompanyId ? { id: { not: options.excludeCompanyId } } : {}),
      },
      select: { id: true, name: true },
      take: limit,
    }),
    prisma.lead.findMany({
      where: {
        workspace_id: workspaceId,
        email: { equals: email, mode: "insensitive" },
        ...(options.excludeLeadId ? { id: { not: options.excludeLeadId } } : {}),
      },
      select: { id: true, title: true, company: { select: { name: true } } },
      take: limit,
    }),
  ]);

  for (const contact of contacts) {
    addMatch(
      matches,
      seen,
      {
        id: contact.id,
        entity: "contact",
        name: contact.full_name,
        company: contact.company_name,
        matchedOn: "email",
      },
      limit,
    );
  }
  for (const company of companies) {
    addMatch(
      matches,
      seen,
      { id: company.id, entity: "company", name: company.name, company: null, matchedOn: "email" },
      limit,
    );
  }
  for (const lead of leads) {
    addMatch(
      matches,
      seen,
      {
        id: lead.id,
        entity: "lead",
        name: lead.title,
        company: lead.company?.name ?? null,
        matchedOn: "email",
      },
      limit,
    );
  }

  return matches;
}

async function findNameDuplicates(
  workspaceId: string,
  name: string,
  options: FindDuplicatesOptions,
  limit: number,
): Promise<DuplicateMatch[]> {
  const matches: DuplicateMatch[] = [];
  const seen = new Set<string>();

  const [contacts, companies] = await Promise.all([
    prisma.contact.findMany({
      where: {
        workspace_id: workspaceId,
        full_name: { equals: name, mode: "insensitive" },
        ...(options.excludeContactId ? { id: { not: options.excludeContactId } } : {}),
      },
      select: { id: true, full_name: true, company_name: true },
      take: limit,
    }),
    prisma.company.findMany({
      where: {
        workspace_id: workspaceId,
        name: { equals: name, mode: "insensitive" },
        ...(options.excludeCompanyId ? { id: { not: options.excludeCompanyId } } : {}),
      },
      select: { id: true, name: true },
      take: limit,
    }),
  ]);

  for (const contact of contacts) {
    addMatch(
      matches,
      seen,
      {
        id: contact.id,
        entity: "contact",
        name: contact.full_name,
        company: contact.company_name,
        matchedOn: "name",
      },
      limit,
    );
  }
  for (const company of companies) {
    addMatch(
      matches,
      seen,
      { id: company.id, entity: "company", name: company.name, company: null, matchedOn: "name" },
      limit,
    );
  }

  if (matches.length < limit && name.length >= 3) {
    const remaining = limit - matches.length;
    const [prefixContacts, prefixCompanies] = await Promise.all([
      prisma.contact.findMany({
        where: {
          workspace_id: workspaceId,
          full_name: { startsWith: name, mode: "insensitive" },
          NOT: { full_name: { equals: name, mode: "insensitive" } },
          ...(options.excludeContactId ? { id: { not: options.excludeContactId } } : {}),
        },
        select: { id: true, full_name: true, company_name: true },
        take: remaining,
      }),
      prisma.company.findMany({
        where: {
          workspace_id: workspaceId,
          name: { startsWith: name, mode: "insensitive" },
          NOT: { name: { equals: name, mode: "insensitive" } },
          ...(options.excludeCompanyId ? { id: { not: options.excludeCompanyId } } : {}),
        },
        select: { id: true, name: true },
        take: remaining,
      }),
    ]);

    for (const contact of prefixContacts) {
      addMatch(
        matches,
        seen,
        {
          id: contact.id,
          entity: "contact",
          name: contact.full_name,
          company: contact.company_name,
          matchedOn: "name",
        },
        limit,
      );
    }
    for (const company of prefixCompanies) {
      addMatch(
        matches,
        seen,
        { id: company.id, entity: "company", name: company.name, company: null, matchedOn: "name" },
        limit,
      );
    }
  }

  return matches;
}

async function findPhoneDuplicates(
  workspaceId: string,
  phone: string,
  options: FindDuplicatesOptions,
  limit: number,
): Promise<DuplicateMatch[]> {
  const suffix = phoneSearchSuffix(phone);
  if (!suffix) {
    return [];
  }

  const matches: DuplicateMatch[] = [];
  const seen = new Set<string>();
  const targetDigits = normalizePhoneDigits(phone);

  const [contacts, companies, leads] = await Promise.all([
    prisma.contact.findMany({
      where: {
        workspace_id: workspaceId,
        phone: { not: null, contains: suffix },
        ...(options.excludeContactId ? { id: { not: options.excludeContactId } } : {}),
      },
      select: { id: true, full_name: true, company_name: true, phone: true },
      take: 10,
    }),
    prisma.company.findMany({
      where: {
        workspace_id: workspaceId,
        phone: { not: null, contains: suffix },
        ...(options.excludeCompanyId ? { id: { not: options.excludeCompanyId } } : {}),
      },
      select: { id: true, name: true, phone: true },
      take: 10,
    }),
    prisma.lead.findMany({
      where: {
        workspace_id: workspaceId,
        phone: { not: null, contains: suffix },
        ...(options.excludeLeadId ? { id: { not: options.excludeLeadId } } : {}),
      },
      select: { id: true, title: true, phone: true, company: { select: { name: true } } },
      take: 10,
    }),
  ]);

  for (const contact of contacts) {
    if (contact.phone && phonesEquivalent(targetDigits, contact.phone)) {
      addMatch(
        matches,
        seen,
        {
          id: contact.id,
          entity: "contact",
          name: contact.full_name,
          company: contact.company_name,
          matchedOn: "phone",
        },
        limit,
      );
    }
  }
  for (const company of companies) {
    if (company.phone && phonesEquivalent(targetDigits, company.phone)) {
      addMatch(
        matches,
        seen,
        { id: company.id, entity: "company", name: company.name, company: null, matchedOn: "phone" },
        limit,
      );
    }
  }
  for (const lead of leads) {
    if (lead.phone && phonesEquivalent(targetDigits, lead.phone)) {
      addMatch(
        matches,
        seen,
        {
          id: lead.id,
          entity: "lead",
          name: lead.title,
          company: lead.company?.name ?? null,
          matchedOn: "phone",
        },
        limit,
      );
    }
  }

  return matches;
}

export function duplicateSearchReady(field: DuplicateField, value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (field === "email") {
    return trimmed.includes("@") && trimmed.length >= 3;
  }
  if (field === "phone") {
    return normalizePhoneDigits(trimmed).length >= 7;
  }
  return trimmed.length >= 2;
}

export async function findDuplicates(
  workspaceId: string,
  field: DuplicateField,
  value: string,
  options: FindDuplicatesOptions = {},
): Promise<DuplicateMatch[]> {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const trimmed = value.trim();
  if (!duplicateSearchReady(field, trimmed)) {
    return [];
  }

  if (field === "email") {
    return findEmailDuplicates(workspaceId, normalizeEmail(trimmed), options, limit);
  }
  if (field === "name") {
    return findNameDuplicates(workspaceId, trimmed, options, limit);
  }
  return findPhoneDuplicates(workspaceId, trimmed, options, limit);
}
