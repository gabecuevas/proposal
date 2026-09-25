import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import {
  BULK_ACCOUNT_ACTIONS,
  runBulkAccountAction,
  type BulkAccountAction,
} from "@/lib/support/account-admin";
import {
  isErrorResponse,
  requireEnvPlatformAdmin,
  requirePlatformAdmin,
} from "@/lib/support/platform-admin";

type Body = {
  action?: string;
  userIds?: unknown;
  reason?: string;
  purgeWorkspaces?: boolean;
  confirm?: string;
};

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Body | null;
  const action = body?.action as BulkAccountAction | undefined;
  if (!action || !BULK_ACCOUNT_ACTIONS.includes(action)) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Unknown action",
    });
  }

  const admin =
    action === "delete" ? await requireEnvPlatformAdmin(request) : await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }

  const userIds = Array.isArray(body?.userIds)
    ? body.userIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (userIds.length === 0) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Select at least one account",
    });
  }
  if (userIds.length > 100) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Select at most 100 accounts at a time",
    });
  }
  if (action === "delete" && body?.confirm !== "DELETE") {
    return errorResponse(request, {
      status: 400,
      code: "confirmation_required",
      message: 'Type DELETE to confirm',
    });
  }

  const results = await runBulkAccountAction({
    action,
    userIds,
    adminUserId: admin.userId,
    reason: typeof body?.reason === "string" ? body.reason.slice(0, 500) : null,
    purgeWorkspaces: body?.purgeWorkspaces === true,
  });

  return jsonWithRequestId(request, {
    action,
    results,
    succeeded: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  });
}
