import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "proposal_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const SUDO_TTL_SECONDS = 60 * 60;
/** Holds the platform admin's own session while they are in sudo mode. */
const SUDO_ADMIN_COOKIE_NAME = "proposal_sudo_admin";

export type SessionPayload = {
  userId: string;
  /** Null while the user has no workspace membership yet (onboarding). */
  workspaceId: string | null;
  role: "OWNER" | "ADMIN" | "MEMBER" | null;
  email: string;
  emailVerified: boolean;
  companySetupComplete: boolean;
  teamStepComplete: boolean;
  /** Set only on sudo sessions minted by a platform admin. */
  impersonatorUserId?: string;
  impersonationId?: string;
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
  const normalized: SessionPayload = {
    userId: String(payload.userId ?? ""),
    workspaceId,
    role,
    email: String(payload.email ?? ""),
    emailVerified: payload.emailVerified === true || legacyComplete,
    companySetupComplete: payload.companySetupComplete === true || legacyComplete,
    teamStepComplete: payload.teamStepComplete === true || legacyComplete,
  };
  if (
    typeof payload.impersonatorUserId === "string" &&
    payload.impersonatorUserId &&
    typeof payload.impersonationId === "string" &&
    payload.impersonationId
  ) {
    normalized.impersonatorUserId = payload.impersonatorUserId;
    normalized.impersonationId = payload.impersonationId;
  }
  return normalized;
}

export function isSudoSession(payload: SessionPayload): boolean {
  return Boolean(payload.impersonationId && payload.impersonatorUserId);
}

export function sessionMaxAgeFor(payload: SessionPayload): number {
  return isSudoSession(payload) ? SUDO_TTL_SECONDS : SESSION_TTL_SECONDS;
}

export async function signSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${sessionMaxAgeFor(payload)}s`)
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
export const SUDO_SESSION_MAX_AGE = SUDO_TTL_SECONDS;
export const SUDO_ADMIN_COOKIE = SUDO_ADMIN_COOKIE_NAME;
