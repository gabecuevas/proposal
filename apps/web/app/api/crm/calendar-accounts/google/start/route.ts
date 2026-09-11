import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import {
  getAppBaseUrl,
  GOOGLE_CALENDAR_OAUTH_SCOPES,
  GOOGLE_CALENDAR_OAUTH_STATE_COOKIE,
  googleCalendarOAuthRedirectUri,
  isGoogleCalendarOAuthConfigured,
} from "@/lib/crm/google-calendar-oauth";

const SETTINGS_PATH = "/app/settings/integrations/calendar";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 10,
    path: "/",
  };
}

export async function GET(request: NextRequest) {
  const baseUrl = getAppBaseUrl(request.url);
  const settingsUrl = new URL(SETTINGS_PATH, baseUrl);

  try {
    await getRequestAuthContext(request);
  } catch {
    return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(SETTINGS_PATH)}`, baseUrl));
  }

  if (!isGoogleCalendarOAuthConfigured()) {
    settingsUrl.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(settingsUrl);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const state = crypto.randomUUID();
  const redirectUri = googleCalendarOAuthRedirectUri(baseUrl);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_OAUTH_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_CALENDAR_OAUTH_STATE_COOKIE, state, cookieOptions());
  return response;
}
