import type { NextResponse } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE,
  signSessionToken,
  type SessionPayload,
} from "./session";

export function applySessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export async function jsonWithSessionCookie(
  request: Request,
  body: Record<string, unknown>,
  payload: SessionPayload,
  init?: { status?: number },
) {
  const response = jsonWithRequestId(request, body, init);
  const token = await signSessionToken(payload);
  applySessionCookie(response, token);
  return response;
}

export async function refreshSessionCookie(
  response: NextResponse,
  payload: SessionPayload,
): Promise<void> {
  const token = await signSessionToken(payload);
  applySessionCookie(response, token);
}
