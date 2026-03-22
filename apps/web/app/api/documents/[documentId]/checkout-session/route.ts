import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { createDocumentCheckoutSession } from "@/lib/payments/checkout";

type Params = { params: Promise<{ documentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const { documentId } = await params;

  try {
    const session = await createDocumentCheckoutSession({
      documentId,
      workspaceId: auth.workspaceId,
      actorUserId: auth.userId,
    });
    return jsonWithRequestId(request, { session }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    if (message === "Document not found") {
      return errorResponse(request, {
        status: 404,
        code: "document_not_found",
        message,
      });
    }
    if (
      message === "Document must be signed before creating checkout session" ||
      message === "Document total must be greater than zero"
    ) {
      return errorResponse(request, {
        status: 400,
        code: "validation_error",
        message,
      });
    }
    if (message.includes("STRIPE_SECRET_KEY")) {
      return errorResponse(request, {
        status: 503,
        code: "payments_not_configured",
        message,
      });
    }
    return errorResponse(request, {
      status: 400,
      code: "checkout_session_failed",
      message,
    });
  }
}
