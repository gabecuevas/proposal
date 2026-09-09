import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function encryptionKey(): Buffer {
  return createHash("sha256")
    .update(process.env.AUTH_SECRET ?? "dev-only-secret-change-me")
    .digest();
}

/** Encrypt OAuth secrets at rest (AES-256-GCM). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64url");
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export const GOOGLE_EMAIL_OAUTH_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
].join(" ");

export const GOOGLE_EMAIL_OAUTH_STATE_COOKIE = "crm_email_google_oauth_state";
export const GOOGLE_EMAIL_OAUTH_EMAIL_COOKIE = "crm_email_google_oauth_email";
export const GOOGLE_EMAIL_OAUTH_ACCOUNT_COOKIE = "crm_email_google_oauth_account";

export function isGoogleEmailOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function getAppBaseUrl(requestUrl: string): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXTAUTH_URL ?? new URL(requestUrl).origin;
}

export function googleEmailOAuthRedirectUri(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/api/crm/email-accounts/google/callback`;
}

export type GoogleTokenExchange = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
  scope: string | null;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeGoogleAuthCode(params: {
  code: string;
  redirectUri: string;
}): Promise<GoogleTokenExchange> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: params.code,
    grant_type: "authorization_code",
    redirect_uri: params.redirectUri,
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json()) as GoogleTokenResponse;
  if (!response.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "Google token exchange failed.");
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: typeof json.expires_in === "number" ? new Date(Date.now() + json.expires_in * 1000) : null,
    scope: json.scope ?? null,
  };
}

export async function fetchGoogleProfileEmail(accessToken: string): Promise<{
  email: string;
  name: string | null;
}> {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const profile = (await response.json()) as {
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  if (!response.ok || !profile.email) {
    throw new Error("Could not read the Google account email.");
  }
  if (profile.email_verified === false) {
    throw new Error("Verify this Google address before connecting it.");
  }
  return { email: profile.email.toLowerCase(), name: profile.name ?? null };
}
