import { NextResponse, type NextRequest } from "next/server";
import { resolveOAuthSession } from "@/lib/auth/oauth-account";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  signSessionToken,
} from "@/lib/auth/session";

const OAUTH_STATE_COOKIE = "google_oauth_state";
const OAUTH_NEXT_COOKIE = "google_oauth_next";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleUserInfo = {
  email?: string;
  email_verified?: boolean;
  name?: string;
};

function getBaseUrl(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? request.nextUrl.origin;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/login?error=google_not_configured", request.url));
  }

  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const nextPath = request.cookies.get(OAUTH_NEXT_COOKIE)?.value;
  if (!code || !returnedState || !cookieState || returnedState !== cookieState) {
    return NextResponse.redirect(new URL("/login?error=google_state_mismatch", request.url));
  }

  const redirectUri = `${getBaseUrl(request)}/api/auth/google/callback`;
  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  });
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  const tokenJson = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenRes.ok || !tokenJson.access_token) {
    return NextResponse.redirect(new URL("/login?error=google_token_exchange_failed", request.url));
  }

  const profileRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
    },
  });
  const profile = (await profileRes.json()) as GoogleUserInfo;
  if (!profileRes.ok || !profile.email || !profile.email_verified) {
    return NextResponse.redirect(new URL("/login?error=google_profile_failed", request.url));
  }

  const sessionPayload = await resolveOAuthSession({
    email: profile.email,
    name: profile.name ?? profile.email,
  });
  const token = await signSessionToken(sessionPayload);
  const redirectTarget = nextPath && nextPath.startsWith("/") ? nextPath : "/app";
  const response = NextResponse.redirect(new URL(redirectTarget, request.url));
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  response.cookies.delete(OAUTH_STATE_COOKIE);
  response.cookies.delete(OAUTH_NEXT_COOKIE);
  return response;
}
