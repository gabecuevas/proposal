import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "proposal_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  userId: string;
  /** Null while the user has no workspace membership yet (onboarding). */
  workspaceId: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER" | null;
  email: string;
  emailVerified: boolean;
  companySetupComplete: boolean;
  teamStepComplete: boolean;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? "dev-only-secret-change-me";
  return new TextEncoder().encode(secret);
}

function normalizePayload(payload: Record<string, unknown>): SessionPayload {
  const workspaceId =
    typeof payload.workspaceId === "string" && payload.workspaceId.length > 0
      ? payload.workspaceId
      : null;
  const role =
    payload.role === "OWNER" || payload.role === "ADMIN" || payload.role === "MEMBER"
      ? payload.role
      : null;
  // Legacy sessions (pre-onboarding) with a workspace are treated as fully onboarded.
  const legacyComplete = Boolean(workspaceId) && payload.emailVerified === undefined;
  return {
    userId: String(payload.userId ?? ""),
    workspaceId,
    role,
    email: String(payload.email ?? ""),
    emailVerified: payload.emailVerified === true || legacyComplete,
    companySetupComplete: payload.companySetupComplete === true || legacyComplete,
    teamStepComplete: payload.teamStepComplete === true || legacyComplete,
  };
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const normalized = normalizePayload(payload as Record<string, unknown>);
    if (!normalized.userId || !normalized.email) {
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

export function getSessionTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(COOKIE_NAME)?.value ?? null;
}

export async function requireSessionFromRequest(request: NextRequest): Promise<SessionPayload | null> {
  const token = getSessionTokenFromRequest(request);
  if (!token) {
    return null;
  }
  return verifySessionToken(token);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
export const SESSION_MAX_AGE = SESSION_TTL_SECONDS;
