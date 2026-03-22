import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { signAuditExportToken, type AuditExportType } from "@/lib/audit/export-token";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";

function parseLimit(raw: unknown): number | null {
  const value = Number(raw ?? 1000);
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.min(5000, Math.max(1, Math.trunc(value)));
}

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");

  const payload = (await request.json().catch(() => ({}))) as {
    type?: AuditExportType;
    before?: string;
    limit?: number;
  };
  if (payload.type !== "activity" && payload.type !== "webhook-deliveries") {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "type must be one of: activity, webhook-deliveries",
    });
  }
  const limit = parseLimit(payload.limit);
  if (!limit) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "limit must be a valid number",
    });
  }
  const before = payload.before ? new Date(payload.before) : undefined;
  if (before && Number.isNaN(before.getTime())) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "before must be a valid ISO datetime",
    });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: auth.workspaceId },
    select: {
      audit_export_token_ttl_minutes: true,
    },
  });
  if (!workspace) {
    return errorResponse(request, {
      status: 404,
      code: "workspace_not_found",
      message: "Workspace not found",
    });
  }
  const ttlMinutes = Math.max(1, Math.trunc(workspace.audit_export_token_ttl_minutes));
  const expiresInSeconds = ttlMinutes * 60;
  const token = await signAuditExportToken({
    workspaceId: auth.workspaceId,
    actorUserId: auth.userId,
    exportType: payload.type,
    before: before?.toISOString(),
    limit,
    expiresInSeconds,
  });
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

  return jsonWithRequestId(request, {
    token,
    policy: {
      ttlMinutes,
    },
    export: {
      type: payload.type,
      before: before?.toISOString() ?? null,
      limit,
    },
    expiresAt,
  });
}
