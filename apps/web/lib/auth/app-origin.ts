import type { NextRequest } from "next/server";

/** Canonical app origin for absolute auth links. Never trust Host alone in production. */
export function getCanonicalAppOrigin(request?: NextRequest): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    process.env.APP_URL;
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  if (request) {
    return request.nextUrl.origin;
  }
  return "http://localhost:3000";
}

/** Safe relative return path only. */
export function safeReturnPath(value: string | null | undefined, fallback = "/app"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  if (value.includes("\\") || value.includes("@")) {
    return fallback;
  }
  return value;
}
