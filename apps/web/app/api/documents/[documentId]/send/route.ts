import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { QuoteApprovalRequiredError, sendDocument } from "@/lib/editor/document-store";
import { logApiEvent } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";
import { enqueueWebhookEvent } from "@/lib/webhooks/queue";

type Params = { params: Promise<{ documentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const { documentId } = await params;
  let document;
  try {
    document = await sendDocument(documentId, auth.workspaceId, auth.userId);
  } catch (error) {
    if (error instanceof QuoteApprovalRequiredError) {
      return errorResponse(request, {
        status: 409,
        code: "quote_approval_required",
        message: error.message,
      });
    }
    throw error;
  }
  if (!document) {
    return errorResponse(request, {
      status: 404,
      code: "document_not_found",
      message: "Document not found",
    });
  }

  await enqueueWebhookEvent({
    workspaceId: auth.workspaceId,
    eventType: "document.sent",
    documentId: document.id,
    actorUserId: auth.userId,
    correlationId: requestId,
    payload: {
      type: "document.sent",
      document: {
        id: document.id,
        status: document.status,
      },
      occurredAt: new Date().toISOString(),
    },
  }).catch(() => {});
  logApiEvent(request, {
    event: "document.sent",
    requestId,
    status: 200,
    workspaceId: auth.workspaceId,
    userId: auth.userId,
    details: {
      documentId: document.id,
    },
  });
  return jsonWithRequestId(request, { document, requestId });
}
