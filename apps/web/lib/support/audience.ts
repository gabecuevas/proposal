/**
 * Versioned, allowlisted audience filter schema shared by Contacts and Campaigns.
 * Only AND conditions. Null / never-logged-in must use explicit is_null operators.
 */

import { Prisma, prisma, type WorkspaceRole } from "@repo/db";

export const AUDIENCE_FILTER_VERSION = 1 as const;

export type AudienceDateOp =
  | { op: "before"; value: string }
  | { op: "after"; value: string }
  | { op: "between"; from: string; to: string }
  | { op: "is_null" }
  | { op: "is_not_null" };

export type AudienceNumberOp =
  | { op: "eq"; value: number }
  | { op: "gte"; value: number }
  | { op: "lte"; value: number }
  | { op: "between"; from: number; to: number };

export type AudienceStringOp =
  | { op: "eq"; value: string }
  | { op: "contains"; value: string }
  | { op: "is_null" }
  | { op: "is_not_null" };

export type AudienceCondition =
  | ({ field: "signup_at" } & AudienceDateOp)
  | ({ field: "last_login_at" } & AudienceDateOp)
  | ({ field: "last_active_at" } & AudienceDateOp)
  | ({ field: "session_count" } & AudienceNumberOp)
  | ({ field: "account_user_count" } & AudienceNumberOp)
  | { field: "role"; op: "eq"; value: "OWNER" | "ADMIN" | "MEMBER" }
  | ({ field: "company" } & AudienceStringOp)
  | ({ field: "city" } & AudienceStringOp)
  | ({ field: "timezone" } & AudienceStringOp)
  | { field: "email_verified"; op: "eq"; value: boolean };

export type AudienceFilters = {
  version: typeof AUDIENCE_FILTER_VERSION;
  conditions: AudienceCondition[];
};

const ALLOWED_FIELDS = new Set([
  "signup_at",
  "last_login_at",
  "last_active_at",
  "session_count",
  "account_user_count",
  "role",
  "company",
  "city",
  "timezone",
  "email_verified",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseDateOp(raw: Record<string, unknown>): AudienceDateOp | null {
  const op = raw.op;
  if (op === "is_null" || op === "is_not_null") {
    return { op };
  }
  if (op === "before" || op === "after") {
    if (typeof raw.value !== "string" || Number.isNaN(Date.parse(raw.value))) {
      return null;
    }
    return { op, value: raw.value };
  }
  if (op === "between") {
    if (
      typeof raw.from !== "string" ||
      typeof raw.to !== "string" ||
      Number.isNaN(Date.parse(raw.from)) ||
      Number.isNaN(Date.parse(raw.to))
    ) {
      return null;
    }
    return { op, from: raw.from, to: raw.to };
  }
  return null;
}

function parseNumberOp(raw: Record<string, unknown>): AudienceNumberOp | null {
  const op = raw.op;
  if (op === "eq" || op === "gte" || op === "lte") {
    if (typeof raw.value !== "number" || !Number.isFinite(raw.value)) {
      return null;
    }
    return { op, value: Math.floor(raw.value) };
  }
  if (op === "between") {
    if (
      typeof raw.from !== "number" ||
      typeof raw.to !== "number" ||
      !Number.isFinite(raw.from) ||
      !Number.isFinite(raw.to)
    ) {
      return null;
    }
    return { op, from: Math.floor(raw.from), to: Math.floor(raw.to) };
  }
  return null;
}

function parseStringOp(raw: Record<string, unknown>): AudienceStringOp | null {
  const op = raw.op;
  if (op === "is_null" || op === "is_not_null") {
    return { op };
  }
  if (op === "eq" || op === "contains") {
    if (typeof raw.value !== "string" || raw.value.length > 200) {
      return null;
    }
    return { op, value: raw.value };
  }
  return null;
}

export function parseAudienceFilters(input: unknown): AudienceFilters {
  if (!isRecord(input)) {
    return { version: AUDIENCE_FILTER_VERSION, conditions: [] };
  }
  const rawConditions = Array.isArray(input.conditions) ? input.conditions : [];
  const conditions: AudienceCondition[] = [];

  for (const raw of rawConditions.slice(0, 20)) {
    if (!isRecord(raw) || typeof raw.field !== "string" || !ALLOWED_FIELDS.has(raw.field)) {
      continue;
    }
    const field = raw.field;
    if (field === "signup_at" || field === "last_login_at" || field === "last_active_at") {
      const dateOp = parseDateOp(raw);
      if (dateOp) {
        conditions.push({ field, ...dateOp } as AudienceCondition);
      }
      continue;
    }
    if (field === "session_count" || field === "account_user_count") {
      const numberOp = parseNumberOp(raw);
      if (numberOp) {
        conditions.push({ field, ...numberOp } as AudienceCondition);
      }
      continue;
    }
    if (field === "role") {
      if (raw.op === "eq" && (raw.value === "OWNER" || raw.value === "ADMIN" || raw.value === "MEMBER")) {
        conditions.push({ field, op: "eq", value: raw.value });
      }
      continue;
    }
    if (field === "company" || field === "city" || field === "timezone") {
      const stringOp = parseStringOp(raw);
      if (stringOp) {
        conditions.push({ field, ...stringOp } as AudienceCondition);
      }
      continue;
    }
    if (field === "email_verified" && raw.op === "eq" && typeof raw.value === "boolean") {
      conditions.push({ field, op: "eq", value: raw.value });
    }
  }

  return { version: AUDIENCE_FILTER_VERSION, conditions };
}

function dateFilter(
  column: "created_at" | "last_login_at" | "last_active_at",
  condition: AudienceDateOp,
): Prisma.UserWhereInput {
  if (condition.op === "is_null") {
    return { [column]: null };
  }
  if (condition.op === "is_not_null") {
    return { [column]: { not: null } };
  }
  if (condition.op === "before") {
    return { [column]: { lt: new Date(condition.value) } };
  }
  if (condition.op === "after") {
    return { [column]: { gt: new Date(condition.value) } };
  }
  return {
    [column]: {
      gte: new Date(condition.from),
      lte: new Date(condition.to),
    },
  };
}

function matchesNumber(actual: number, op: AudienceNumberOp): boolean {
  switch (op.op) {
    case "eq":
      return actual === op.value;
    case "gte":
      return actual >= op.value;
    case "lte":
      return actual <= op.value;
    case "between":
      return actual >= op.from && actual <= op.to;
    default:
      return false;
  }
}

/** Prisma pre-filter for fields that map cleanly; count fields are post-filtered. */
export function audienceFiltersToWhere(filters: AudienceFilters): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [];

  for (const condition of filters.conditions) {
    switch (condition.field) {
      case "signup_at":
        and.push(dateFilter("created_at", condition));
        break;
      case "last_login_at":
        and.push(dateFilter("last_login_at", condition));
        break;
      case "last_active_at":
        and.push(dateFilter("last_active_at", condition));
        break;
      case "session_count":
        if (condition.op === "eq" && condition.value === 0) {
          and.push({ activity_sessions: { none: {} } });
        } else if (condition.op === "gte" && condition.value <= 1) {
          and.push({ activity_sessions: { some: {} } });
        }
        break;
      case "role":
        and.push({
          workspace_memberships: {
            some: { role: condition.value as WorkspaceRole },
          },
        });
        break;
      case "company":
        if (condition.op === "is_null") {
          and.push({ workspace_memberships: { none: {} } });
        } else if (condition.op === "is_not_null") {
          and.push({ workspace_memberships: { some: {} } });
        } else if (condition.op === "eq") {
          and.push({
            workspace_memberships: {
              some: { workspace: { name: { equals: condition.value, mode: "insensitive" } } },
            },
          });
        } else {
          and.push({
            workspace_memberships: {
              some: { workspace: { name: { contains: condition.value, mode: "insensitive" } } },
            },
          });
        }
        break;
      case "city":
        if (condition.op === "is_null") {
          and.push({ city: null });
        } else if (condition.op === "is_not_null") {
          and.push({ city: { not: null } });
        } else if (condition.op === "eq") {
          and.push({ city: { equals: condition.value, mode: "insensitive" } });
        } else {
          and.push({ city: { contains: condition.value, mode: "insensitive" } });
        }
        break;
      case "timezone":
        if (condition.op === "is_null") {
          and.push({ personal_timezone: null });
        } else if (condition.op === "is_not_null") {
          and.push({ personal_timezone: { not: null } });
        } else if (condition.op === "eq") {
          and.push({ personal_timezone: { equals: condition.value, mode: "insensitive" } });
        } else {
          and.push({
            personal_timezone: { contains: condition.value, mode: "insensitive" },
          });
        }
        break;
      case "email_verified":
        and.push(
          condition.value ? { email_verified_at: { not: null } } : { email_verified_at: null },
        );
        break;
      default:
        break;
    }
  }

  return and.length > 0 ? { AND: and } : {};
}

export type AudienceMatch = {
  userId: string;
  workspaceId: string | null;
  email: string;
  name: string;
};

/**
 * Evaluate audience with the same semantics for preview and delivery.
 * Account-scoped metrics (role, account size, company) bind to one membership at a time —
 * we never combine a role from workspace A with a user count from workspace B.
 */
export async function evaluateAudienceUsers(
  filtersInput: unknown,
  options?: { limit?: number; cursorUserId?: string },
): Promise<{ matches: AudienceMatch[]; nextCursor: string | null; totalEstimate: number }> {
  const filters = parseAudienceFilters(filtersInput);
  const where = audienceFiltersToWhere(filters);
  const limit = Math.min(500, Math.max(1, options?.limit ?? 100));

  const sessionCountCond = filters.conditions.find((c) => c.field === "session_count");
  const accountSizeCond = filters.conditions.find((c) => c.field === "account_user_count");
  const roleCond = filters.conditions.find((c) => c.field === "role");

  const users = await prisma.user.findMany({
    where: {
      ...where,
      ...(options?.cursorUserId ? { id: { gt: options.cursorUserId } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit * 3,
    select: {
      id: true,
      email: true,
      name: true,
      _count: { select: { activity_sessions: true } },
      workspace_memberships: {
        select: {
          role: true,
          workspace_id: true,
          workspace: {
            select: {
              id: true,
              name: true,
              _count: { select: { members: true } },
            },
          },
        },
      },
    },
  });

  const matches: AudienceMatch[] = [];
  for (const user of users) {
    if (sessionCountCond && sessionCountCond.field === "session_count") {
      if (!matchesNumber(user._count.activity_sessions, sessionCountCond)) {
        continue;
      }
    }

    let chosenWorkspaceId: string | null = null;
    if (user.workspace_memberships.length === 0) {
      if (roleCond || accountSizeCond) {
        continue;
      }
    } else {
      const eligible = user.workspace_memberships.filter((m) => {
        if (roleCond && roleCond.field === "role" && m.role !== roleCond.value) {
          return false;
        }
        if (accountSizeCond && accountSizeCond.field === "account_user_count") {
          if (!matchesNumber(m.workspace._count.members, accountSizeCond)) {
            return false;
          }
        }
        return true;
      });
      if ((roleCond || accountSizeCond) && eligible.length === 0) {
        continue;
      }
      chosenWorkspaceId = (eligible[0] ?? user.workspace_memberships[0])?.workspace_id ?? null;
    }

    matches.push({
      userId: user.id,
      workspaceId: chosenWorkspaceId,
      email: user.email,
      name: user.name,
    });
    if (matches.length >= limit) {
      break;
    }
  }

  const totalEstimate = await prisma.user.count({ where });
  const nextCursor =
    matches.length >= limit ? matches[matches.length - 1]?.userId ?? null : null;

  return { matches, nextCursor, totalEstimate };
}

export function summarizeAudience(filtersInput: unknown): string {
  const filters = parseAudienceFilters(filtersInput);
  if (filters.conditions.length === 0) {
    return "All users";
  }
  return filters.conditions
    .map((c) => {
      if ("value" in c && c.value !== undefined) {
        return `${c.field} ${c.op} ${String(c.value)}`;
      }
      if ("from" in c) {
        return `${c.field} ${c.op} ${String(c.from)}–${String(c.to)}`;
      }
      return `${c.field} ${c.op}`;
    })
    .join(" AND ");
}
