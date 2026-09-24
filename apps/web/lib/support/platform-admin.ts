import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/response";
import { requireSessionFromRequest, type SessionPayload } from "@/lib/auth/session";
import { isSupportAdminEnabled, platformAdminEmails } from "@/lib/support/flags";

export type PlatformAdminContext = {
  userId: string;
  email: string;
  name: string;
  session: SessionPayload;
};

/** Sync PLATFORM_ADMIN_EMAILS onto the user row (idempotent). Never trusts client role. */
export async function syncPlatformAdminFlag(userId: string, email: string): Promise<boolean> {
  const allow = platformAdminEmails();
  if (allow.length === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { is_platform_admin: true },
    });
    return Boolean(user?.is_platform_admin);
  }
  const shouldBeAdmin = allow.includes(email.trim().toLowerCase());
  const user = await prisma.user.update({
    where: { id: userId },
    data: { is_platform_admin: shouldBeAdmin },
    select: { is_platform_admin: true },
  });
  return user.is_platform_admin;
}

export async function requirePlatformAdmin(
  request: NextRequest,
): Promise<PlatformAdminContext | ReturnType<typeof errorResponse>> {
  if (!isSupportAdminEnabled()) {
    return errorResponse(request, {
      status: 404,
      code: "not_found",
      message: "Not found",
    });
  }

  const session = await requireSessionFromRequest(request);
  if (!session) {
    return errorResponse(request, {
      status: 401,
      code: "unauthorized",
      message: "Unauthorized",
    });
  }

  const isAdmin = await syncPlatformAdminFlag(session.userId, session.email);
  if (!isAdmin) {
    return errorResponse(request, {
      status: 403,
      code: "forbidden",
      message: "Platform administrator access required",
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) {
    return errorResponse(request, {
      status: 401,
      code: "unauthorized",
      message: "Unauthorized",
    });
  }

  return {
    userId: user.id,
    email: user.email,
    name: user.name,
    session,
  };
}

export function isErrorResponse(
  value: PlatformAdminContext | ReturnType<typeof errorResponse>,
): value is ReturnType<typeof errorResponse> {
  return !("userId" in value);
}
