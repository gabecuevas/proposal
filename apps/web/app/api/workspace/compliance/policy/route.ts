import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import {
  MAX_CPQ_APPROVAL_THRESHOLD,
  MIN_CPQ_APPROVAL_THRESHOLD,
} from "@/lib/cpq/approval";

const MIN_RETENTION_DAYS = 7;
const MAX_RETENTION_DAYS = 3650;
const MIN_EXPORT_TTL_MINUTES = 1;
const MAX_EXPORT_TTL_MINUTES = 1440;

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");

  const workspace = await prisma.workspace.findUnique({
    where: { id: auth.workspaceId },
    select: {
      id: true,
      audit_retention_days: true,
      audit_export_token_ttl_minutes: true,
      cpq_approval_discount_threshold: true,
    },
  });
  if (!workspace) {
    return errorResponse(request, {
      status: 404,
      code: "workspace_not_found",
      message: "Workspace not found",
    });
  }

  return jsonWithRequestId(request, {
    policy: {
      workspaceId: workspace.id,
      auditRetentionDays: workspace.audit_retention_days,
      auditExportTokenTtlMinutes: workspace.audit_export_token_ttl_minutes,
      cpqApprovalDiscountThreshold: workspace.cpq_approval_discount_threshold,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");

  const payload = (await request.json().catch(() => ({}))) as {
    auditRetentionDays?: number;
    auditExportTokenTtlMinutes?: number;
    cpqApprovalDiscountThreshold?: number;
  };

  const retention = payload.auditRetentionDays;
  const ttl = payload.auditExportTokenTtlMinutes;
  const cpqThreshold = payload.cpqApprovalDiscountThreshold;
  if (
    retention !== undefined &&
    (!Number.isFinite(retention) || retention < MIN_RETENTION_DAYS || retention > MAX_RETENTION_DAYS)
  ) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: `auditRetentionDays must be between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS}`,
    });
  }
  if (
    ttl !== undefined &&
    (!Number.isFinite(ttl) || ttl < MIN_EXPORT_TTL_MINUTES || ttl > MAX_EXPORT_TTL_MINUTES)
  ) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: `auditExportTokenTtlMinutes must be between ${MIN_EXPORT_TTL_MINUTES} and ${MAX_EXPORT_TTL_MINUTES}`,
    });
  }
  if (
    cpqThreshold !== undefined &&
    (!Number.isFinite(cpqThreshold) ||
      cpqThreshold < MIN_CPQ_APPROVAL_THRESHOLD ||
      cpqThreshold > MAX_CPQ_APPROVAL_THRESHOLD)
  ) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: `cpqApprovalDiscountThreshold must be between ${MIN_CPQ_APPROVAL_THRESHOLD} and ${MAX_CPQ_APPROVAL_THRESHOLD}`,
    });
  }
  if (retention === undefined && ttl === undefined && cpqThreshold === undefined) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "At least one policy field must be provided",
    });
  }

  const updated = await prisma.workspace.update({
    where: { id: auth.workspaceId },
    data: {
      audit_retention_days: retention !== undefined ? Math.trunc(retention) : undefined,
      audit_export_token_ttl_minutes: ttl !== undefined ? Math.trunc(ttl) : undefined,
      cpq_approval_discount_threshold: cpqThreshold !== undefined ? Math.trunc(cpqThreshold) : undefined,
    },
    select: {
      id: true,
      audit_retention_days: true,
      audit_export_token_ttl_minutes: true,
      cpq_approval_discount_threshold: true,
    },
  });

  return jsonWithRequestId(request, {
    policy: {
      workspaceId: updated.id,
      auditRetentionDays: updated.audit_retention_days,
      auditExportTokenTtlMinutes: updated.audit_export_token_ttl_minutes,
      cpqApprovalDiscountThreshold: updated.cpq_approval_discount_threshold,
    },
  });
}
