import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [total, active, revoked, expired, usedLast7d] = await Promise.all([
    prisma.apiKey.count({
      where: { workspace_id: auth.workspaceId },
    }),
    prisma.apiKey.count({
      where: {
        workspace_id: auth.workspaceId,
        revoked_at: null,
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
      },
    }),
    prisma.apiKey.count({
      where: {
        workspace_id: auth.workspaceId,
        revoked_at: { not: null },
      },
    }),
    prisma.apiKey.count({
      where: {
        workspace_id: auth.workspaceId,
        revoked_at: null,
        expires_at: { lte: now },
      },
    }),
    prisma.apiKey.count({
      where: {
        workspace_id: auth.workspaceId,
        last_used_at: { gte: sevenDaysAgo },
      },
    }),
  ]);

  return jsonWithRequestId(request, {
    analytics: {
      total,
      active,
      revoked,
      expired,
      usedLast7d,
      computedAt: now.toISOString(),
    },
  });
}
