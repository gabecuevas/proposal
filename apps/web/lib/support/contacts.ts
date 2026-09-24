import { Prisma } from "@repo/db";
import { prisma } from "@repo/db";
import { parseAudienceFilters, audienceFiltersToWhere } from "@/lib/support/audience";
import { rowsToCsv } from "@/lib/support/csv";

export type ContactSortField =
  | "email"
  | "name"
  | "last_login_at"
  | "last_active_at"
  | "created_at";

export async function searchPlatformContacts(query: {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: ContactSortField;
  sortDir?: "asc" | "desc";
  filtersJson?: unknown;
}) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 25));
  const sort = query.sort ?? "last_active_at";
  const sortDir = query.sortDir ?? "desc";
  const audienceWhere = audienceFiltersToWhere(parseAudienceFilters(query.filtersJson));

  const where: Prisma.UserWhereInput = { ...audienceWhere };
  if (query.search?.trim()) {
    const q = query.search.trim();
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
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

  const orderBy: Prisma.UserOrderByWithRelationInput = { [sort]: sortDir };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        city: true,
        city_source: true,
        personal_timezone: true,
        timezone_source: true,
        email_verified_at: true,
        is_platform_admin: true,
        last_login_at: true,
        last_active_at: true,
        tracked_since: true,
        created_at: true,
        _count: {
          select: {
            workspace_memberships: true,
            support_conversations: true,
            activity_sessions: true,
          },
        },
        workspace_memberships: {
          select: {
            role: true,
            workspace: {
              select: {
                id: true,
                name: true,
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

  return {
    total,
    page,
    pageSize,
    contacts: users.map((u) => {
      const primary = u.workspace_memberships[0] ?? null;
      return {
        id: u.id,
        email: u.email,
        name: u.name,
        phone: u.phone,
        city: u.city ?? "Unknown",
        citySource: u.city_source,
        timezone: u.personal_timezone ?? "Unknown",
        timezoneSource: u.timezone_source,
        emailVerified: Boolean(u.email_verified_at),
        isPlatformAdmin: u.is_platform_admin,
        lastLoginAt: u.last_login_at?.toISOString() ?? null,
        lastActiveAt: u.last_active_at?.toISOString() ?? null,
        trackedSince: u.tracked_since?.toISOString() ?? null,
        createdAt: u.created_at.toISOString(),
        sessionCount: u._count.activity_sessions,
        workspaceCount: u._count.workspace_memberships,
        conversationCount: u._count.support_conversations,
        company: primary?.workspace.name ?? "Unknown",
        userType: primary?.role === "OWNER" ? "Account Owner" : primary ? "User" : "Unknown",
        accountUserCount: primary?.workspace._count.members ?? null,
        memberships: u.workspace_memberships.map((m) => ({
          workspaceId: m.workspace.id,
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
    ]),
  );
}

export async function getPlatformContactDetail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      city: true,
      city_source: true,
      personal_timezone: true,
      timezone_source: true,
      email_verified_at: true,
      is_platform_admin: true,
      last_login_at: true,
      last_active_at: true,
      tracked_since: true,
      created_at: true,
      _count: { select: { activity_sessions: true } },
      workspace_memberships: {
        select: {
          role: true,
          created_at: true,
          workspace: {
            select: {
              id: true,
              name: true,
              _count: { select: { members: true } },
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
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    city: user.city ?? "Unknown",
    citySource: user.city_source,
    timezone: user.personal_timezone ?? "Unknown",
    timezoneSource: user.timezone_source,
    emailVerified: Boolean(user.email_verified_at),
    isPlatformAdmin: user.is_platform_admin,
    lastLoginAt: user.last_login_at?.toISOString() ?? null,
    lastActiveAt: user.last_active_at?.toISOString() ?? null,
    trackedSince: user.tracked_since?.toISOString() ?? null,
    createdAt: user.created_at.toISOString(),
    sessionCount: user._count.activity_sessions,
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
