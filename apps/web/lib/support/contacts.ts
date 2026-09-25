import { Prisma } from "@repo/db";
import { prisma } from "@repo/db";
import { parseAudienceFilters, audienceFiltersToWhere } from "@/lib/support/audience";
import { countQualifiedSessions, countTrackedSessions } from "@/lib/support/activity";
import { rowsToCsv } from "@/lib/support/csv";
import { formatIpCity } from "@/lib/support/geo";
import { formatAccountId, formatUserId, parsePublicId } from "@/lib/support/public-ids";

export type ContactSortField =
  | "email"
  | "name"
  | "last_login_at"
  | "last_active_at"
  | "created_at";

export const CONTACT_STATUSES = ["active", "disabled", "archived"] as const;
export const CONTACT_TYPES = ["owner", "user"] as const;
export const CONTACT_FLAGS = ["frozen", "unverified"] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number];
export type ContactType = (typeof CONTACT_TYPES)[number];
export type ContactFlag = (typeof CONTACT_FLAGS)[number];

export type ContactFilters = {
  statuses: ContactStatus[];
  types: ContactType[];
  flags: ContactFlag[];
};

/** Default Contacts view hides archived accounts. */
export const DEFAULT_CONTACT_STATUSES: ContactStatus[] = ["active", "disabled"];

function parseList<T extends string>(value: string | null | undefined, allowed: readonly T[]): T[] {
  if (!value) {
    return [];
  }
  return [...new Set(value.split(","))].filter((v): v is T => allowed.includes(v as T));
}

export function parseContactFilters(params: URLSearchParams): ContactFilters {
  const rawStatus = params.get("status");
  return {
    statuses: rawStatus === null ? DEFAULT_CONTACT_STATUSES : parseList(rawStatus, CONTACT_STATUSES),
    types: parseList(params.get("type"), CONTACT_TYPES),
    flags: parseList(params.get("flags"), CONTACT_FLAGS),
  };
}

const statusWhereMap: Record<ContactStatus, Prisma.UserWhereInput> = {
  active: { archived_at: null, disabled_at: null },
  disabled: { archived_at: null, disabled_at: { not: null } },
  archived: { archived_at: { not: null } },
};

const typeWhereMap: Record<ContactType, Prisma.UserWhereInput> = {
  owner: { workspace_memberships: { some: { role: "OWNER" } } },
  user: { workspace_memberships: { none: { role: "OWNER" } } },
};

const flagWhereMap: Record<ContactFlag, Prisma.UserWhereInput> = {
  frozen: {
    workspace_memberships: {
      some: { role: "OWNER", workspace: { billing_frozen_at: { not: null } } },
    },
  },
  unverified: { email_verified_at: null },
};

/** Statuses and types match any checked option (empty = any); every checked flag must match. */
export function contactFiltersToWhere(filters: ContactFilters): Prisma.UserWhereInput[] {
  const clauses: Prisma.UserWhereInput[] = [];
  if (filters.statuses.length > 0 && filters.statuses.length < CONTACT_STATUSES.length) {
    clauses.push({ OR: filters.statuses.map((s) => statusWhereMap[s]) });
  }
  if (filters.types.length > 0 && filters.types.length < CONTACT_TYPES.length) {
    clauses.push({ OR: filters.types.map((t) => typeWhereMap[t]) });
  }
  for (const flag of filters.flags) {
    clauses.push(flagWhereMap[flag]);
  }
  return clauses;
}

export async function searchPlatformContacts(query: {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: ContactSortField;
  sortDir?: "asc" | "desc";
  filtersJson?: unknown;
  filters?: ContactFilters;
}) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const sort = query.sort ?? "last_active_at";
  const sortDir = query.sortDir ?? "desc";
  const audienceWhere = audienceFiltersToWhere(parseAudienceFilters(query.filtersJson));

  const where: Prisma.UserWhereInput = { ...audienceWhere };
  const filterClauses = contactFiltersToWhere(
    query.filters ?? { statuses: DEFAULT_CONTACT_STATUSES, types: [], flags: [] },
  );
  if (filterClauses.length > 0) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      ...filterClauses,
    ];
  }
  if (query.search?.trim()) {
    const q = query.search.trim();
    const publicId = parsePublicId(q);
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          ...(publicId?.kind === "user" ? [{ user_number: publicId.number }] : []),
          ...(publicId?.kind === "account"
            ? [{ workspace_memberships: { some: { workspace: { account_number: publicId.number } } } }]
            : []),
          { email: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          {
            workspace_memberships: {
              some: { workspace: { name: { contains: q, mode: "insensitive" } } },
            },
          },
        ],
      },
    ];
  }

  const orderBy: Prisma.UserOrderByWithRelationInput =
    sort === "created_at" || sort === "email" || sort === "name"
      ? { [sort]: sortDir }
      : { [sort]: { sort: sortDir, nulls: "last" } };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        user_number: true,
        email: true,
        name: true,
        phone: true,
        city: true,
        city_source: true,
        ip_region: true,
        ip_country: true,
        ip_timezone: true,
        email_verified_at: true,
        is_platform_admin: true,
        disabled_at: true,
        disabled_reason: true,
        archived_at: true,
        last_login_at: true,
        last_active_at: true,
        tracked_since: true,
        created_at: true,
        _count: {
          select: {
            workspace_memberships: true,
            support_conversations: true,
          },
        },
        workspace_memberships: {
          select: {
            role: true,
            workspace: {
              select: {
                id: true,
                account_number: true,
                name: true,
                billing_frozen_at: true,
                _count: { select: { members: true } },
              },
            },
          },
          orderBy: { created_at: "asc" },
          take: 5,
        },
      },
    }),
  ]);
  const sessionCounts = await countQualifiedSessions(users.map((u) => u.id));

  return {
    total,
    page,
    pageSize,
    contacts: users.map((u) => {
      const primary = u.workspace_memberships[0] ?? null;
      const billingFrozen = u.workspace_memberships.some(
        (m) => m.role === "OWNER" && m.workspace.billing_frozen_at,
      );
      return {
        disabledAt: u.disabled_at?.toISOString() ?? null,
        disabledReason: u.disabled_reason,
        archivedAt: u.archived_at?.toISOString() ?? null,
        billingFrozen,
        status: u.archived_at ? "Archived" : u.disabled_at ? "Disabled" : "Active",
        id: u.id,
        userId: formatUserId(u.user_number),
        accountId: primary ? formatAccountId(primary.workspace.account_number) : null,
        email: u.email,
        name: u.name,
        phone: u.phone,
        city:
          u.city_source === "ip"
            ? formatIpCity({ city: u.city, region: u.ip_region, country: u.ip_country })
            : "Unknown",
        timezone: u.ip_timezone ?? "Unknown",
        emailVerified: Boolean(u.email_verified_at),
        isPlatformAdmin: u.is_platform_admin,
        lastLoginAt: u.last_login_at?.toISOString() ?? null,
        lastActiveAt: u.last_active_at?.toISOString() ?? null,
        trackedSince: u.tracked_since?.toISOString() ?? null,
        createdAt: u.created_at.toISOString(),
        sessionCount: sessionCounts.get(u.id) ?? 0,
        workspaceCount: u._count.workspace_memberships,
        conversationCount: u._count.support_conversations,
        company: primary?.workspace.name ?? "Unknown",
        userType: primary?.role === "OWNER" ? "Account Owner" : primary ? "User" : "Unknown",
        accountUserCount: primary?.workspace._count.members ?? null,
        memberships: u.workspace_memberships.map((m) => ({
          workspaceId: m.workspace.id,
          accountId: formatAccountId(m.workspace.account_number),
          workspaceName: m.workspace.name,
          role: m.role,
          accountUserCount: m.workspace._count.members,
        })),
      };
    }),
  };
}

export async function exportContactsCsv(query: {
  search?: string;
  filtersJson?: unknown;
  filters?: ContactFilters;
}): Promise<string> {
  const result = await searchPlatformContacts({
    ...query,
    page: 1,
    pageSize: 100,
  });
  // Cap export to 5 pages for safety in v1
  const rows = [...result.contacts];
  let page = 2;
  while (page <= 5 && rows.length < result.total) {
    const next = await searchPlatformContacts({
      ...query,
      page,
      pageSize: 100,
    });
    rows.push(...next.contacts);
    if (next.contacts.length === 0) {
      break;
    }
    page += 1;
  }

  return rowsToCsv(
    [
      "name",
      "email",
      "company",
      "userType",
      "signupDate",
      "lastLogin",
      "lastActive",
      "sessionCount",
      "accountUserCount",
      "city",
      "timezone",
      "emailVerified",
      "status",
      "billingFrozen",
      "accountId",
      "userId",
    ],
    rows.map((r) => [
      r.name,
      r.email,
      r.company,
      r.userType,
      r.createdAt,
      r.lastLoginAt ?? "Not tracked",
      r.lastActiveAt ?? "Not tracked",
      String(r.sessionCount),
      r.accountUserCount == null ? "Unknown" : String(r.accountUserCount),
      r.city,
      r.timezone,
      r.emailVerified ? "yes" : "no",
      r.status,
      r.billingFrozen ? "yes" : "no",
      r.accountId ?? "",
      r.userId,
    ]),
  );
}

export type ContactUserStatus = "Active" | "Disabled" | "Archived";
export type ContactAccountStatus = "Active" | "Disabled" | "Archived";

function userStatus(user: { disabled_at: Date | null; archived_at: Date | null }): ContactUserStatus {
  return user.archived_at ? "Archived" : user.disabled_at ? "Disabled" : "Active";
}

/** Billing is shown separately; "Cancelled" arrives once subscriptions exist. */
export function accountStatus(input: {
  ownerArchived: boolean;
  memberCount: number;
  disabledCount: number;
}): ContactAccountStatus {
  if (input.ownerArchived) return "Archived";
  if (input.memberCount > 0 && input.disabledCount === input.memberCount) return "Disabled";
  return "Active";
}

export async function getPlatformContactDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      user_number: true,
      email: true,
      name: true,
      phone: true,
      city: true,
      city_source: true,
      ip_region: true,
      ip_country: true,
      ip_timezone: true,
      personal_timezone: true,
      timezone_source: true,
      email_verified_at: true,
      is_platform_admin: true,
      disabled_at: true,
      archived_at: true,
      last_login_at: true,
      last_active_at: true,
      tracked_since: true,
      created_at: true,
      workspace_memberships: {
        orderBy: { created_at: "asc" },
        select: {
          role: true,
          created_at: true,
          workspace: {
            select: {
              id: true,
              account_number: true,
              name: true,
              owner_user_id: true,
              billing_frozen_at: true,
              createdAt: true,
              _count: { select: { members: true } },
              members: {
                orderBy: { created_at: "asc" },
                take: 50,
                select: {
                  role: true,
                  user: {
                    select: {
                      id: true,
                      user_number: true,
                      name: true,
                      email: true,
                      disabled_at: true,
                      archived_at: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      support_contact_notes_about: {
        orderBy: { created_at: "desc" },
        take: 50,
        include: { author: { select: { id: true, name: true, email: true } } },
      },
      support_conversations: {
        orderBy: { last_message_at: "desc" },
        take: 20,
        select: {
          id: true,
          subject: true,
          status: true,
          last_message_at: true,
          admin_unread_count: true,
        },
      },
      campaign_deliveries: {
        orderBy: { delivered_at: "desc" },
        take: 20,
        include: { campaign: { select: { id: true, title: true, status: true } } },
      },
    },
  });
  if (!user) {
    return null;
  }
  const accounts = user.workspace_memberships.map((m) => {
    const w = m.workspace;
    const members = w.members.map((member) => ({
      userId: formatUserId(member.user.user_number),
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      role: member.role,
      userType: member.role === "OWNER" ? "Account Owner" : "User",
      status: userStatus(member.user),
    }));
    const owner =
      w.members.find((member) => member.user.id === w.owner_user_id) ??
      w.members.find((member) => member.role === "OWNER") ??
      null;
    return {
      id: w.id,
      accountId: formatAccountId(w.account_number),
      name: w.name,
      status: accountStatus({
        ownerArchived: Boolean(owner?.user.archived_at),
        memberCount: w.members.length,
        disabledCount: w.members.filter((member) => member.user.disabled_at).length,
      }),
      billingFrozen: Boolean(w.billing_frozen_at),
      createdAt: w.createdAt.toISOString(),
      userCount: w._count.members,
      role: m.role,
      members,
    };
  });

  return {
    id: user.id,
    userId: formatUserId(user.user_number),
    status: userStatus(user),
    account: accounts[0] ?? null,
    otherAccounts: accounts.slice(1),
    email: user.email,
    name: user.name,
    phone: user.phone,
    city:
      user.city_source === "ip"
        ? formatIpCity({ city: user.city, region: user.ip_region, country: user.ip_country })
        : "Unknown",
    timezone: user.ip_timezone ?? "Unknown",
    profileTimezone: user.personal_timezone,
    emailVerified: Boolean(user.email_verified_at),
    isPlatformAdmin: user.is_platform_admin,
    lastLoginAt: user.last_login_at?.toISOString() ?? null,
    lastActiveAt: user.last_active_at?.toISOString() ?? null,
    trackedSince: user.tracked_since?.toISOString() ?? null,
    createdAt: user.created_at.toISOString(),
    sessionCount: await countTrackedSessions(user.id),
    memberships: user.workspace_memberships.map((m) => ({
      workspaceId: m.workspace.id,
      workspaceName: m.workspace.name,
      role: m.role,
      userType: m.role === "OWNER" ? "Account Owner" : "User",
      accountUserCount: m.workspace._count.members,
      joinedAt: m.created_at.toISOString(),
    })),
    notes: user.support_contact_notes_about.map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.created_at.toISOString(),
      author: n.author,
    })),
    conversations: user.support_conversations.map((c) => ({
      id: c.id,
      subject: c.subject,
      status: c.status,
      lastMessageAt: c.last_message_at.toISOString(),
      adminUnreadCount: c.admin_unread_count,
    })),
    campaignDeliveries: user.campaign_deliveries.map((d) => ({
      id: d.id,
      campaignId: d.campaign.id,
      title: d.campaign.title,
      status: d.campaign.status,
      deliveredAt: d.delivered_at.toISOString(),
      viewedAt: d.viewed_at?.toISOString() ?? null,
      clickedAt: d.clicked_at?.toISOString() ?? null,
      repliedAt: d.replied_at?.toISOString() ?? null,
    })),
  };
}
