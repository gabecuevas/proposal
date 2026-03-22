import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { computeAuditChecksum } from "@/lib/audit/checksum";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";

function parseLimit(raw: string | null): number {
  const value = Number(raw ?? 1000);
  if (!Number.isFinite(value)) {
    return 1000;
  }
  return Math.min(5000, Math.max(1, Math.trunc(value)));
}

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const beforeRaw = url.searchParams.get("before");
  const before = beforeRaw ? new Date(beforeRaw) : undefined;
  const cutoff = before && !Number.isNaN(before.getTime()) ? before : undefined;
  const expectedChecksum = url.searchParams.get("expectedChecksum") ?? undefined;
  const limit = parseLimit(url.searchParams.get("limit"));

  if (type !== "activity" && type !== "webhook-deliveries") {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "type must be one of: activity, webhook-deliveries",
    });
  }

  const rows =
    type === "activity"
      ? await prisma.documentActivityEvent.findMany({
          where: {
            workspace_id: auth.workspaceId,
            created_at: cutoff ? { lt: cutoff } : undefined,
          },
          orderBy: [{ created_at: "desc" }, { id: "desc" }],
          take: limit,
        })
      : await prisma.webhookDelivery.findMany({
          where: {
            workspace_id: auth.workspaceId,
            created_at: cutoff ? { lt: cutoff } : undefined,
          },
          orderBy: [{ created_at: "desc" }, { id: "desc" }],
          take: limit,
        });

  const checksum = computeAuditChecksum({
    workspaceId: auth.workspaceId,
    type,
    before: cutoff?.toISOString(),
    rows,
  });
  return jsonWithRequestId(request, {
    checksum,
    expectedChecksum: expectedChecksum ?? null,
    matches: expectedChecksum ? checksum === expectedChecksum : null,
    type,
    rowCount: rows.length,
    before: cutoff?.toISOString() ?? null,
    limit,
  });
}
