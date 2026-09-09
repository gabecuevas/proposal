import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { activateGoogleEmailAccount } from "@/lib/crm/emails";
import {
  encryptSecret,
  exchangeGoogleAuthCode,
  fetchGoogleProfileEmail,
  getAppBaseUrl,
  GOOGLE_EMAIL_OAUTH_ACCOUNT_COOKIE,
  GOOGLE_EMAIL_OAUTH_EMAIL_COOKIE,
  GOOGLE_EMAIL_OAUTH_STATE_COOKIE,
  googleEmailOAuthRedirectUri,
  isGoogleEmailOAuthConfigured,
} from "@/lib/crm/google-email-oauth";

const SETTINGS_PATH = "/app/settings/integrations/email";

function clearOAuthCookies(response: NextResponse) {
  response.cookies.delete(GOOGLE_EMAIL_OAUTH_STATE_COOKIE);
  response.cookies.delete(GOOGLE_EMAIL_OAUTH_EMAIL_COOKIE);
  response.cookies.delete(GOOGLE_EMAIL_OAUTH_ACCOUNT_COOKIE);
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

  if (!isGoogleEmailOAuthConfigured()) {
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
  const cookieState = request.cookies.get(GOOGLE_EMAIL_OAUTH_STATE_COOKIE)?.value;
  const expectedEmail = request.cookies.get(GOOGLE_EMAIL_OAUTH_EMAIL_COOKIE)?.value?.toLowerCase() ?? null;
  const accountId = request.cookies.get(GOOGLE_EMAIL_OAUTH_ACCOUNT_COOKIE)?.value ?? null;

  if (request.nextUrl.searchParams.get("error")) {
    return fail("google_denied");
  }
  if (!code || !returnedState || !cookieState || returnedState !== cookieState) {
    return fail("google_state_mismatch");
  }

  try {
    const tokens = await exchangeGoogleAuthCode({
      code,
      redirectUri: googleEmailOAuthRedirectUri(baseUrl),
    });
    const profile = await fetchGoogleProfileEmail(tokens.accessToken);
    if (expectedEmail && profile.email !== expectedEmail) {
      return fail("google_email_mismatch");
    }

    const account = await activateGoogleEmailAccount(auth.workspaceId, {
      email: profile.email,
      userId: auth.userId,
      senderName: profile.name,
      accountId,
      accessTokenEncrypted: encryptSecret(tokens.accessToken),
      refreshTokenEncrypted: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope,
    });

    settingsUrl.searchParams.set("connected", "1");
    settingsUrl.searchParams.set("accountId", account.id);
    const response = NextResponse.redirect(settingsUrl);
    clearOAuthCookies(response);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.toLowerCase().includes("limit")) {
      return fail("account_limit");
    }
    if (message.toLowerCase().includes("different provider")) {
      return fail("provider_conflict");
    }
    return fail("google_connect_failed");
  }
}
