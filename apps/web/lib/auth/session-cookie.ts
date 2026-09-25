import type { NextResponse } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  sessionMaxAgeFor,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "./session";

export function applySessionCookie(
  response: NextResponse,
  token: string,
  maxAge: number = SESSION_MAX_AGE,
): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    path: "/",
  });
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) {
    return null;
  }
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return null;
}

/**
 * Re-issued sessions keep the sudo claims of the current cookie so that a
 * profile save or onboarding step during sudo cannot mint a full user session.
 */
async function withCurrentSudoClaims(
  request: Request,
  payload: SessionPayload,
): Promise<SessionPayload> {
  const token = readCookie(request, SESSION_COOKIE_NAME);
  if (!token) {
    return payload;
  }
  const current = await verifySessionToken(token);
  if (!current?.impersonationId || current.userId !== payload.userId) {
    return payload;
  }
  return {
    ...payload,
    impersonatorUserId: current.impersonatorUserId,
    impersonationId: current.impersonationId,
  };
}

export async function jsonWithSessionCookie(
  request: Request,
  body: Record<string, unknown>,
  payload: SessionPayload,
  init?: { status?: number },
) {
  const response = jsonWithRequestId(request, body, init);
  const effective = await withCurrentSudoClaims(request, payload);
  const token = await signSessionToken(effective);
  applySessionCookie(response, token, sessionMaxAgeFor(effective));
  return response;
}

export async function refreshSessionCookie(
  response: NextResponse,
  payload: SessionPayload,
): Promise<void> {
  const token = await signSessionToken(payload);
  applySessionCookie(response, token, sessionMaxAgeFor(payload));
}
