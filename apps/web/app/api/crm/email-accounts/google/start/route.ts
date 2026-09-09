import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import {
  getAppBaseUrl,
  GOOGLE_EMAIL_OAUTH_ACCOUNT_COOKIE,
  GOOGLE_EMAIL_OAUTH_EMAIL_COOKIE,
  GOOGLE_EMAIL_OAUTH_SCOPES,
  GOOGLE_EMAIL_OAUTH_STATE_COOKIE,
  googleEmailOAuthRedirectUri,
  isGoogleEmailOAuthConfigured,
} from "@/lib/crm/google-email-oauth";

const SETTINGS_PATH = "/app/settings/integrations/email";

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

  if (!isGoogleEmailOAuthConfigured()) {
    settingsUrl.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(settingsUrl);
  }

  const emailParam = request.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";
  const accountId = request.nextUrl.searchParams.get("accountId")?.trim() ?? "";
  if (emailParam && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailParam)) {
    settingsUrl.searchParams.set("error", "invalid_email");
    return NextResponse.redirect(settingsUrl);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const state = crypto.randomUUID();
  const redirectUri = googleEmailOAuthRedirectUri(baseUrl);
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_EMAIL_OAUTH_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("state", state);
  if (emailParam) {
    url.searchParams.set("login_hint", emailParam);
  }

  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_EMAIL_OAUTH_STATE_COOKIE, state, cookieOptions());
  if (emailParam) {
    response.cookies.set(GOOGLE_EMAIL_OAUTH_EMAIL_COOKIE, emailParam, cookieOptions());
  } else {
    response.cookies.delete(GOOGLE_EMAIL_OAUTH_EMAIL_COOKIE);
  }
  if (accountId) {
    response.cookies.set(GOOGLE_EMAIL_OAUTH_ACCOUNT_COOKIE, accountId, cookieOptions());
  } else {
    response.cookies.delete(GOOGLE_EMAIL_OAUTH_ACCOUNT_COOKIE);
  }
  return response;
}
