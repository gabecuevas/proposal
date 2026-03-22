import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import {
  getDocument,
  getLatestQuoteApproval,
  requestQuoteApproval,
} from "@/lib/editor/document-store";
import { getDiscountPercent, getWorkspaceCpqPolicy, requiresQuoteApproval } from "@/lib/cpq/approval";

type Params = { params: Promise<{ documentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  const { documentId } = await params;
  const document = await getDocument(documentId, auth.workspaceId);
  if (!document) {
    return errorResponse(request, {
      status: 404,
      code: "document_not_found",
      message: "Document not found",
    });
  }

  const policy = await getWorkspaceCpqPolicy(auth.workspaceId);
  const discountPercent = getDiscountPercent(document.pricing_json);
  const approvalRequired = requiresQuoteApproval({
    discountPercent,
    thresholdPercent: policy.discountApprovalThreshold,
  });
  const latest = await getLatestQuoteApproval(documentId, auth.workspaceId);

  return jsonWithRequestId(request, {
    approval: latest,
    summary: {
      discountPercent,
      thresholdPercent: policy.discountApprovalThreshold,
      approvalRequired,
      canSend: !approvalRequired || latest?.status === "APPROVED",
    },
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const { documentId } = await params;
  const payload = (await request.json().catch(() => ({}))) as { reason?: string };

  try {
    const approval = await requestQuoteApproval({
      documentId,
      workspaceId: auth.workspaceId,
      actorUserId: auth.userId,
      reason: payload.reason,
    });
    return jsonWithRequestId(request, { approval }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to request approval";
    if (message === "Document not found") {
      return errorResponse(request, {
        status: 404,
        code: "document_not_found",
        message,
      });
    }
    if (message === "Approval is not required for current discount") {
      return errorResponse(request, {
        status: 400,
        code: "approval_not_required",
        message,
      });
    }
    return errorResponse(request, {
      status: 400,
      code: "approval_request_failed",
      message,
    });
  }
}
