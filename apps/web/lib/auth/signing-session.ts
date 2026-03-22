import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

const SIGNING_TTL_SECONDS = 60 * 60 * 12;

export type SigningSessionPayload = {
  documentId: string;
  recipientId: string;
  workspaceId: string;
  purpose: "signing";
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? "dev-only-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function signSigningSessionToken(payload: SigningSessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SIGNING_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySigningSessionToken(token: string): Promise<SigningSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const typed = payload as SigningSessionPayload;
    if (typed.purpose !== "signing") {
      return null;
    }
    return typed;
  } catch {
    return null;
  }
}

export function getSigningTokenFromRequest(request: NextRequest): string | null {
  const headerValue = request.headers.get("x-signing-token");
  if (headerValue) {
    return headerValue;
  }
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length);
  }
  return null;
}
