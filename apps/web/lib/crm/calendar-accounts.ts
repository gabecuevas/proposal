import { prisma, prismaHasModel } from "@repo/db";
import {
  decryptSecret,
  encryptSecret,
  listGoogleCalendarEvents,
  listGoogleCalendars,
  refreshGoogleAccessToken,
} from "@/lib/crm/google-calendar-oauth";

export type CrmCalendarAccountDto = {
  id: string;
  email: string;
  calendarId: string;
  calendarName: string | null;
  syncStatus: "INACTIVE" | "ACTIVE" | "ERROR";
  lastSyncedAt: string | null;
  provider: "GOOGLE";
};

export type CrmCalendarEventDto = {
  id: string;
  accountId: string;
  externalId: string;
  title: string;
  description: string | null;
  location: string | null;
  htmlLink: string | null;
  allDay: boolean;
  startsAt: string;
  endsAt: string;
};

function ensureCalendarStorage() {
  if (!prismaHasModel("crmCalendarAccount") || !prismaHasModel("crmCalendarEvent")) {
    throw new Error(
      "Calendar sync storage isn’t ready yet. Restart the app (or run prisma generate) and try again.",
    );
  }
}

export function serializeCalendarAccount(row: {
  id: string;
  email: string;
  calendar_id: string;
  calendar_name: string | null;
  sync_status: "INACTIVE" | "ACTIVE" | "ERROR";
  last_synced_at: Date | null;
  provider: "GOOGLE";
}): CrmCalendarAccountDto {
  return {
    id: row.id,
    email: row.email,
    calendarId: row.calendar_id,
    calendarName: row.calendar_name,
    syncStatus: row.sync_status,
    lastSyncedAt: row.last_synced_at?.toISOString() ?? null,
    provider: row.provider,
  };
}

export function serializeCalendarEvent(row: {
  id: string;
  account_id: string;
  external_id: string;
  title: string;
  description: string | null;
  location: string | null;
  html_link: string | null;
  all_day: boolean;
  starts_at: Date;
  ends_at: Date;
}): CrmCalendarEventDto {
  return {
    id: row.id,
    accountId: row.account_id,
    externalId: row.external_id,
    title: row.title,
    description: row.description,
    location: row.location,
    htmlLink: row.html_link,
    allDay: row.all_day,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
  };
}

export async function listCalendarAccounts(workspaceId: string, userId: string) {
  if (!prismaHasModel("crmCalendarAccount")) {
    return [];
  }
  const rows = await prisma.crmCalendarAccount.findMany({
    where: { workspace_id: workspaceId, user_id: userId },
    orderBy: { created_at: "asc" },
  });
  return rows.map(serializeCalendarAccount);
}

export async function getCalendarAccountForUser(workspaceId: string, userId: string) {
  if (!prismaHasModel("crmCalendarAccount")) {
    return null;
  }
  return prisma.crmCalendarAccount.findFirst({
    where: { workspace_id: workspaceId, user_id: userId, provider: "GOOGLE" },
  });
}

export async function activateGoogleCalendarAccount(input: {
  workspaceId: string;
  userId: string;
  email: string;
  accessTokenEncrypted: string;
  refreshTokenEncrypted: string | null;
  expiresAt: Date | null;
  scope: string | null;
  calendarId?: string;
  calendarName?: string | null;
}) {
  ensureCalendarStorage();
  const existing = await prisma.crmCalendarAccount.findFirst({
    where: {
      workspace_id: input.workspaceId,
      user_id: input.userId,
      provider: "GOOGLE",
    },
  });

  if (existing) {
    return prisma.crmCalendarAccount.update({
      where: { id: existing.id },
      data: {
        email: input.email,
        calendar_id: input.calendarId ?? existing.calendar_id,
        calendar_name: input.calendarName ?? existing.calendar_name,
        sync_status: "ACTIVE",
        oauth_access_token: input.accessTokenEncrypted,
        oauth_refresh_token: input.refreshTokenEncrypted ?? existing.oauth_refresh_token,
        oauth_expires_at: input.expiresAt,
        oauth_scope: input.scope,
      },
    });
  }

  return prisma.crmCalendarAccount.create({
    data: {
      workspace_id: input.workspaceId,
      user_id: input.userId,
      provider: "GOOGLE",
      email: input.email,
      calendar_id: input.calendarId ?? "primary",
      calendar_name: input.calendarName ?? null,
      sync_status: "ACTIVE",
      oauth_access_token: input.accessTokenEncrypted,
      oauth_refresh_token: input.refreshTokenEncrypted,
      oauth_expires_at: input.expiresAt,
      oauth_scope: input.scope,
    },
  });
}

export async function disconnectCalendarAccount(workspaceId: string, userId: string, accountId: string) {
  ensureCalendarStorage();
  const account = await prisma.crmCalendarAccount.findFirst({
    where: { id: accountId, workspace_id: workspaceId, user_id: userId },
  });
  if (!account) {
    throw new Error("Calendar account not found.");
  }
  await prisma.crmCalendarEvent.deleteMany({ where: { account_id: account.id } });
  await prisma.crmCalendarAccount.delete({ where: { id: account.id } });
  return { id: account.id, email: account.email };
}

async function resolveCalendarAccessToken(account: {
  id: string;
  oauth_access_token: string | null;
  oauth_refresh_token: string | null;
  oauth_expires_at: Date | null;
}) {
  if (!account.oauth_access_token && !account.oauth_refresh_token) {
    throw new Error("This calendar is not authorized. Connect Google Calendar first.");
  }

  const expiresAt = account.oauth_expires_at?.getTime() ?? 0;
  const stillValid = account.oauth_access_token && expiresAt > Date.now() + 60_000;
  if (stillValid && account.oauth_access_token) {
    return decryptSecret(account.oauth_access_token);
  }

  if (!account.oauth_refresh_token) {
    throw new Error("Google Calendar access expired. Reconnect under Calendar Sync.");
  }

  const refreshed = await refreshGoogleAccessToken(decryptSecret(account.oauth_refresh_token));
  await prisma.crmCalendarAccount.update({
    where: { id: account.id },
    data: {
      oauth_access_token: encryptSecret(refreshed.accessToken),
      oauth_expires_at: refreshed.expiresAt,
      oauth_scope: refreshed.scope,
    },
  });
  return refreshed.accessToken;
}

export async function syncGoogleCalendarAccount(
  workspaceId: string,
  userId: string,
  accountId: string,
): Promise<{ imported: number; scanned: number }> {
  ensureCalendarStorage();
  const account = await prisma.crmCalendarAccount.findFirst({
    where: { id: accountId, workspace_id: workspaceId, user_id: userId },
  });
  if (!account) {
    throw new Error("Calendar account not found.");
  }
  if (account.sync_status !== "ACTIVE") {
    throw new Error("Connect Google Calendar before syncing.");
  }

  const accessToken = await resolveCalendarAccessToken(account);
  let calendarId = account.calendar_id || "primary";
  let calendarName = account.calendar_name;

  try {
    const calendars = await listGoogleCalendars(accessToken);
    const primary = calendars.find((item) => item.primary) ?? calendars[0];
    if (primary) {
      calendarId = primary.id;
      calendarName = primary.summary;
    }
  } catch {
    // Keep stored calendar id if list fails.
  }

  const now = new Date();
  const timeMin = new Date(now);
  timeMin.setDate(timeMin.getDate() - 14);
  const timeMax = new Date(now);
  timeMax.setDate(timeMax.getDate() + 120);

  const events = await listGoogleCalendarEvents({
    accessToken,
    calendarId,
    timeMin,
    timeMax,
    maxResults: 300,
  });

  let imported = 0;
  const seenExternalIds: string[] = [];

  for (const event of events) {
    seenExternalIds.push(event.externalId);
    await prisma.crmCalendarEvent.upsert({
      where: {
        workspace_id_external_id: {
          workspace_id: workspaceId,
          external_id: event.externalId,
        },
      },
      create: {
        workspace_id: workspaceId,
        account_id: account.id,
        external_id: event.externalId,
        calendar_id: event.calendarId,
        title: event.title,
        description: event.description,
        location: event.location,
        html_link: event.htmlLink,
        status: event.status,
        all_day: event.allDay,
        starts_at: event.startsAt,
        ends_at: event.endsAt,
      },
      update: {
        account_id: account.id,
        calendar_id: event.calendarId,
        title: event.title,
        description: event.description,
        location: event.location,
        html_link: event.htmlLink,
        status: event.status,
        all_day: event.allDay,
        starts_at: event.startsAt,
        ends_at: event.endsAt,
      },
    });
    imported += 1;
  }

  // Drop previously synced events in-window that disappeared from Google.
  await prisma.crmCalendarEvent.deleteMany({
    where: {
      account_id: account.id,
      starts_at: { gte: timeMin, lt: timeMax },
      ...(seenExternalIds.length
        ? { external_id: { notIn: seenExternalIds } }
        : {}),
    },
  });

  await prisma.crmCalendarAccount.update({
    where: { id: account.id },
    data: {
      calendar_id: calendarId,
      calendar_name: calendarName,
      last_synced_at: new Date(),
      sync_status: "ACTIVE",
    },
  });

  return { imported, scanned: events.length };
}

export async function listCalendarEvents(
  workspaceId: string,
  userId: string,
  range: { from: Date; to: Date },
) {
  if (!prismaHasModel("crmCalendarEvent") || !prismaHasModel("crmCalendarAccount")) {
    return [];
  }
  const account = await prisma.crmCalendarAccount.findFirst({
    where: { workspace_id: workspaceId, user_id: userId, provider: "GOOGLE", sync_status: "ACTIVE" },
    select: { id: true },
  });
  if (!account) {
    return [];
  }

  const rows = await prisma.crmCalendarEvent.findMany({
    where: {
      workspace_id: workspaceId,
      account_id: account.id,
      starts_at: { lt: range.to },
      ends_at: { gt: range.from },
    },
    orderBy: { starts_at: "asc" },
    take: 500,
  });
  return rows.map(serializeCalendarEvent);
}
