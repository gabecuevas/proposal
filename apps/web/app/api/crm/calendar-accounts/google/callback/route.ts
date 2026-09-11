import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { activateGoogleCalendarAccount, syncGoogleCalendarAccount } from "@/lib/crm/calendar-accounts";
import {
  encryptSecret,
  exchangeGoogleAuthCode,
  fetchGoogleProfileEmail,
  getAppBaseUrl,
  GOOGLE_CALENDAR_OAUTH_STATE_COOKIE,
  googleCalendarOAuthRedirectUri,
  isGoogleCalendarOAuthConfigured,
  listGoogleCalendars,
} from "@/lib/crm/google-calendar-oauth";

const SETTINGS_PATH = "/app/settings/integrations/calendar";

function clearOAuthCookies(response: NextResponse) {
  response.cookies.delete(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE);
}

export async function GET(request: NextRequest) {
  const baseUrl = getAppBaseUrl(request.url);
  const settingsUrl = new URL(SETTINGS_PATH, baseUrl);

  const fail = (code: string) => {
    settingsUrl.searchParams.set("error", code);
    const response = NextResponse.redirect(settingsUrl);
    clearOAuthCookies(response);
    return response;
  };

  if (!isGoogleCalendarOAuthConfigured()) {
    return fail("google_not_configured");
  }

  let auth;
  try {
    auth = await getRequestAuthContext(request);
  } catch {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(SETTINGS_PATH)}`, baseUrl));
  }

  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE)?.value;

  if (request.nextUrl.searchParams.get("error")) {
    return fail("google_denied");
  }
  if (!code || !returnedState || !cookieState || returnedState !== cookieState) {
    return fail("google_state_mismatch");
  }

  try {
    const tokens = await exchangeGoogleAuthCode({
      code,
      redirectUri: googleCalendarOAuthRedirectUri(baseUrl),
    });
    const profile = await fetchGoogleProfileEmail(tokens.accessToken);

    let calendarId = "primary";
    let calendarName: string | null = "Primary";
    try {
      const calendars = await listGoogleCalendars(tokens.accessToken);
      const primary = calendars.find((item) => item.primary) ?? calendars[0];
      if (primary) {
        calendarId = primary.id;
        calendarName = primary.summary;
      }
    } catch {
      // Keep defaults.
    }

    const account = await activateGoogleCalendarAccount({
      workspaceId: auth.workspaceId,
      userId: auth.userId,
      email: profile.email,
      accessTokenEncrypted: encryptSecret(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
      calendarId,
      calendarName,
    });

    try {
      await syncGoogleCalendarAccount(auth.workspaceId, auth.userId, account.id);
    } catch {
      // Connection still succeeds even if the first sync fails.
    }

    settingsUrl.searchParams.set("connected", "1");
    settingsUrl.searchParams.set("accountId", account.id);
    const response = NextResponse.redirect(settingsUrl);
    clearOAuthCookies(response);
    return response;
  } catch {
    return fail("google_connect_failed");
  }
}
