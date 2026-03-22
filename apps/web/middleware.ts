import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

const protectedApiPrefixes = [
  "/api/dashboard",
  "/api/contacts",
  "/api/templates",
  "/api/content-blocks",
  "/api/documents",
  "/api/analytics",
  "/api/workspace",
  "/api/audit",
];

function isProtectedApi(pathname: string): boolean {
  return protectedApiPrefixes.some((prefix) => pathname.startsWith(prefix));
}

function isTokenAccessibleDocumentApi(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] !== "api" || parts[1] !== "documents" || !parts[2]) {
    return false;
  }
  const suffix = parts.slice(3).join("/");
  return (
    suffix === "render" ||
    suffix === "signer-fields" ||
    suffix.startsWith("signer-fields/") ||
    suffix === "viewed" ||
    suffix === "artifact"
  );
}

function getOrCreateRequestId(request: NextRequest): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

function applySecurityHeaders(response: NextResponse, request: NextRequest) {
  response.headers.set("x-content-type-options", "nosniff");
  response.headers.set("referrer-policy", "strict-origin-when-cross-origin");
  response.headers.set("permissions-policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("cross-origin-opener-policy", "same-origin");
  if (request.nextUrl.protocol === "https:") {
    response.headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }
}

function nextWithRequestId(request: NextRequest, requestId: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
  response.headers.set("x-request-id", requestId);
  applySecurityHeaders(response, request);
  return response;
}

function getClientIdentifier(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
}

function getRateLimitConfig(request: NextRequest): { scope: string; limit: number; windowMs: number } | null {
  const pathname = request.nextUrl.pathname;
  const method = request.method;

  if (pathname.startsWith("/api/auth/login") || pathname.startsWith("/api/auth/signup")) {
    return { scope: "auth", limit: 15, windowMs: 60_000 };
  }
  if (pathname.startsWith("/api/auth/")) {
    return { scope: "auth-other", limit: 60, windowMs: 60_000 };
  }

  if (pathname.startsWith("/api/workspace/api-keys")) {
    return { scope: "workspace-api-keys", limit: 30, windowMs: 60_000 };
  }
  if (pathname.includes("/api/workspace/webhooks/deliveries/") && pathname.endsWith("/replay")) {
    return { scope: "webhook-replay", limit: 20, windowMs: 60_000 };
  }
  if (pathname.startsWith("/api/audit/")) {
    return { scope: "audit", limit: 90, windowMs: 60_000 };
  }

  if (pathname.startsWith("/api/documents/")) {
    const parts = pathname.split("/").filter(Boolean);
    const suffix = parts.slice(3).join("/");
    if (suffix === "signing-session") {
      return { scope: "signing-session", limit: 30, windowMs: 60_000 };
    }
    if (
      suffix === "viewed" ||
      suffix === "render" ||
      suffix === "signer-fields" ||
      suffix.startsWith("signer-fields/")
    ) {
      const limit = method === "GET" ? 180 : 90;
      return { scope: "signing-public", limit, windowMs: 60_000 };
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = getOrCreateRequestId(request);
  const rateLimit = getRateLimitConfig(request);
  if (rateLimit) {
    const key = `${rateLimit.scope}:${getClientIdentifier(request)}`;
    const result = checkRateLimit({
      key,
      limit: rateLimit.limit,
      windowMs: rateLimit.windowMs,
    });
    if (!result.allowed) {
      const response = NextResponse.json(
        {
          error: "Too many requests",
          requestId,
          retry_after_seconds: result.retryAfterSeconds,
        },
        { status: 429 },
      );
      response.headers.set("x-request-id", requestId);
      response.headers.set("retry-after", String(result.retryAfterSeconds));
      response.headers.set("x-ratelimit-limit", String(result.limit));
      response.headers.set("x-ratelimit-remaining", String(result.remaining));
      response.headers.set("x-ratelimit-reset", String(result.resetAt));
      applySecurityHeaders(response, request);
      return response;
    }
  }
  const isProtectedRoute = pathname.startsWith("/app") || isProtectedApi(pathname);

  if (!isProtectedRoute) {
    return nextWithRequestId(request, requestId);
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    const authorization = request.headers.get("authorization");
    if (pathname.startsWith("/api/") && authorization?.startsWith("Bearer pk_live_")) {
      return nextWithRequestId(request, requestId);
    }

    if (
      pathname.startsWith("/api/") &&
      isTokenAccessibleDocumentApi(pathname) &&
      (Boolean(request.headers.get("x-signing-token")) || request.nextUrl.searchParams.has("token"))
    ) {
      return nextWithRequestId(request, requestId);
    }

    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      response.headers.set("x-request-id", requestId);
      applySecurityHeaders(response, request);
      return response;
    }
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname);
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("x-request-id", requestId);
    applySecurityHeaders(response, request);
    return response;
  }

  return nextWithRequestId(request, requestId);
}

export const config = {
  matcher: ["/app/:path*", "/sign/:path*", "/api/:path*"],
};
