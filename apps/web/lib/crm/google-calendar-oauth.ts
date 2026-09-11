import {
  decryptSecret,
  encryptSecret,
  exchangeGoogleAuthCode,
  fetchGoogleProfileEmail,
  getAppBaseUrl,
  isGoogleEmailOAuthConfigured,
  refreshGoogleAccessToken,
  type GoogleTokenExchange,
} from "@/lib/crm/google-email-oauth";

export {
  decryptSecret,
  encryptSecret,
  exchangeGoogleAuthCode,
  fetchGoogleProfileEmail,
  getAppBaseUrl,
  refreshGoogleAccessToken,
  type GoogleTokenExchange,
};

export const GOOGLE_CALENDAR_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
].join(" ");

export const GOOGLE_CALENDAR_OAUTH_STATE_COOKIE = "crm_calendar_google_oauth_state";

export function isGoogleCalendarOAuthConfigured(): boolean {
  return isGoogleEmailOAuthConfigured();
}

export function googleCalendarOAuthRedirectUri(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/crm/calendar-accounts/google/callback`;
}

export type GoogleCalendarListItem = {
  id: string;
  summary: string;
  primary: boolean;
};

export type GoogleCalendarEventItem = {
  externalId: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  htmlLink: string | null;
  status: string | null;
  allDay: boolean;
  startsAt: Date;
  endsAt: Date;
};

type GoogleEventDate = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

function parseEventBounds(start: GoogleEventDate | undefined, end: GoogleEventDate | undefined): {
  allDay: boolean;
  startsAt: Date;
  endsAt: Date;
} | null {
  if (start?.dateTime) {
    const startsAt = new Date(start.dateTime);
    const endsAt = end?.dateTime ? new Date(end.dateTime) : new Date(startsAt.getTime() + 60 * 60 * 1000);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return null;
    }
    return { allDay: false, startsAt, endsAt };
  }
  if (start?.date) {
    const startsAt = new Date(`${start.date}T00:00:00`);
    const endDate = end?.date ?? start.date;
    const endsAt = new Date(`${endDate}T00:00:00`);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      return null;
    }
    return { allDay: true, startsAt, endsAt };
  }
  return null;
}

export async function listGoogleCalendars(accessToken: string): Promise<GoogleCalendarListItem[]> {
  const response = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const json = (await response.json()) as {
    items?: Array<{ id?: string; summary?: string; primary?: boolean }>;
    error?: { message?: string };
  };
  if (!response.ok) {
    throw new Error(json.error?.message || "Could not list Google calendars.");
  }
  return (json.items ?? [])
    .filter((item): item is { id: string; summary?: string; primary?: boolean } => Boolean(item.id))
    .map((item) => ({
      id: item.id,
      summary: item.summary?.trim() || item.id,
      primary: Boolean(item.primary),
    }));
}

export async function listGoogleCalendarEvents(params: {
  accessToken: string;
  calendarId?: string;
  timeMin: Date;
  timeMax: Date;
  maxResults?: number;
}): Promise<GoogleCalendarEventItem[]> {
  const calendarId = encodeURIComponent(params.calendarId || "primary");
  const events: GoogleCalendarEventItem[] = [];
  let pageToken: string | undefined;
  const limit = Math.min(Math.max(params.maxResults ?? 250, 1), 500);

  while (events.length < limit) {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("timeMin", params.timeMin.toISOString());
    url.searchParams.set("timeMax", params.timeMax.toISOString());
    url.searchParams.set("maxResults", String(Math.min(100, limit - events.length)));
    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    const json = (await response.json()) as {
      items?: Array<{
        id?: string;
        summary?: string;
        description?: string;
        location?: string;
        htmlLink?: string;
        status?: string;
        start?: GoogleEventDate;
        end?: GoogleEventDate;
      }>;
      nextPageToken?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      throw new Error(json.error?.message || "Could not list Google Calendar events.");
    }

    for (const item of json.items ?? []) {
      if (!item.id || item.status === "cancelled") {
        continue;
      }
      const bounds = parseEventBounds(item.start, item.end);
      if (!bounds) {
        continue;
      }
      events.push({
        externalId: item.id,
        calendarId: params.calendarId || "primary",
        title: item.summary?.trim() || "(no title)",
        description: item.description?.trim() || null,
        location: item.location?.trim() || null,
        htmlLink: item.htmlLink ?? null,
        status: item.status ?? null,
        allDay: bounds.allDay,
        startsAt: bounds.startsAt,
        endsAt: bounds.endsAt,
      });
    }

    if (!json.nextPageToken || (json.items?.length ?? 0) === 0) {
      break;
    }
    pageToken = json.nextPageToken;
  }

  return events;
}
