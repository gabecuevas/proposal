import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { decideQuoteApproval } from "@/lib/editor/document-store";

type Params = { params: Promise<{ documentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");

  const { documentId } = await params;
  const payload = (await request.json().catch(() => ({}))) as {
    decision?: "APPROVED" | "REJECTED";
    reason?: string;
  };
  if (payload.decision !== "APPROVED" && payload.decision !== "REJECTED") {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "decision must be APPROVED or REJECTED",
    });
  }

  try {
    const approval = await decideQuoteApproval({
      documentId,
      workspaceId: auth.workspaceId,
      actorUserId: auth.userId,
      decision: payload.decision,
      reason: payload.reason,
    });
    return jsonWithRequestId(request, { approval });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process approval decision";
    if (message === "No pending approval request found") {
      return errorResponse(request, {
        status: 404,
        code: "approval_not_found",
        message,
      });
    }
    return errorResponse(request, {
      status: 400,
      code: "approval_decision_failed",
      message,
    });
  }
}
