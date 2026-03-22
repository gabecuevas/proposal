import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";

type RetentionBody = {
  olderThanDays?: number;
  dryRun?: boolean;
};

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");

  const workspace = await prisma.workspace.findUnique({
    where: { id: auth.workspaceId },
    select: {
      audit_retention_days: true,
    },
  });
  if (!workspace) {
    return errorResponse(request, {
      status: 404,
      code: "workspace_not_found",
      message: "Workspace not found",
    });
  }

  const payload = (await request.json().catch(() => ({}))) as RetentionBody;
  const policyRetentionDays = Math.max(1, Math.trunc(workspace.audit_retention_days));
  const olderThanDays = payload.olderThanDays ?? policyRetentionDays;
  if (!Number.isFinite(olderThanDays) || olderThanDays <= 0) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "olderThanDays must be a positive number",
    });
  }
  if (olderThanDays > policyRetentionDays) {
    return errorResponse(request, {
      status: 400,
      code: "retention_policy_violation",
      message: `olderThanDays cannot exceed workspace policy (${policyRetentionDays})`,
    });
  }
  const dryRun = payload.dryRun ?? true;
  const cutoff = new Date(Date.now() - Math.trunc(olderThanDays) * 24 * 60 * 60 * 1000);

  if (dryRun) {
    const [activityCandidates, webhookCandidates] = await Promise.all([
      prisma.documentActivityEvent.count({
        where: {
          workspace_id: auth.workspaceId,
          created_at: { lt: cutoff },
        },
      }),
      prisma.webhookDelivery.count({
        where: {
          workspace_id: auth.workspaceId,
          created_at: { lt: cutoff },
          status: { in: ["SUCCESS", "DEAD_LETTER"] },
        },
      }),
    ]);
    return jsonWithRequestId(request, {
      dryRun: true,
      policyRetentionDays,
      cutoff: cutoff.toISOString(),
      candidates: {
        documentActivityEvents: activityCandidates,
        webhookDeliveries: webhookCandidates,
      },
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const deletedActivity = await tx.documentActivityEvent.deleteMany({
      where: {
        workspace_id: auth.workspaceId,
        created_at: { lt: cutoff },
      },
    });
    const deletedWebhookDeliveries = await tx.webhookDelivery.deleteMany({
      where: {
        workspace_id: auth.workspaceId,
        created_at: { lt: cutoff },
        status: { in: ["SUCCESS", "DEAD_LETTER"] },
      },
    });
    return {
      deletedActivity: deletedActivity.count,
      deletedWebhookDeliveries: deletedWebhookDeliveries.count,
    };
  });

  return jsonWithRequestId(request, {
    dryRun: false,
    policyRetentionDays,
    cutoff: cutoff.toISOString(),
    deleted: {
      documentActivityEvents: result.deletedActivity,
      webhookDeliveries: result.deletedWebhookDeliveries,
    },
  });
}
