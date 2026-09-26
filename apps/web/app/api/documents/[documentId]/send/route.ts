import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import {
  QuoteApprovalRequiredError,
  DocumentAlreadySentError,
  LineItemRequiredError,
  sendDocument,
} from "@/lib/editor/document-store";
import { getCanonicalAppOrigin } from "@/lib/auth/app-origin";
import { enqueueDocumentDeliveryEmails } from "@/lib/documents/deliver-document";
import { logApiEvent } from "@/lib/observability/logger";
import { getRequestId } from "@/lib/observability/request-id";
import { enqueueWebhookEvent } from "@/lib/webhooks/queue";

type Params = { params: Promise<{ documentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const requestId = getRequestId(request);
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const { documentId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    delivery?: "email" | "manual";
    subject?: unknown;
    message?: unknown;
  };
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
    if (error instanceof LineItemRequiredError) {
      return errorResponse(request, {
        status: 422,
        code: "line_item_required",
        message: error.message,
      });
    }
    if (error instanceof DocumentAlreadySentError) {
      return errorResponse(request, {
        status: 409,
        code: "document_already_sent",
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

  let emailedRecipients = 0;
  if (body.delivery === "email") {
    try {
      emailedRecipients = await enqueueDocumentDeliveryEmails({
        document,
        senderUserId: auth.userId,
        subject: typeof body.subject === "string" ? body.subject : "",
        message: typeof body.message === "string" ? body.message : "",
        origin: getCanonicalAppOrigin(request),
      });
    } catch (error) {
      logApiEvent(request, {
        level: "error",
        event: "document.delivery_email_failed",
        requestId,
        status: 200,
        workspaceId: auth.workspaceId,
        userId: auth.userId,
        details: { documentId: document.id, error: error instanceof Error ? error.message : "unknown" },
      });
    }
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
      delivery: body.delivery ?? null,
      emailedRecipients,
    },
  });
  return jsonWithRequestId(request, { document, emailedRecipients, requestId });
}
