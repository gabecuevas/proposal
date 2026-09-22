import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { recordManualPayment } from "@/lib/commercial/store";

type Params = { params: Promise<{ documentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const { documentId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    amountMinor?: number;
    currency?: string;
    paidAt?: string | null;
    reference?: string | null;
    idempotencyKey?: string;
  };

  if (!body.idempotencyKey || typeof body.amountMinor !== "number" || !body.currency) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "amountMinor, currency, and idempotencyKey are required",
    });
  }

  try {
    const result = await recordManualPayment({
      documentId,
      workspaceId: auth.workspaceId,
      actorUserId: auth.userId,
      amountMinor: body.amountMinor,
      currency: body.currency,
      paidAt: body.paidAt,
      reference: body.reference,
      idempotencyKey: body.idempotencyKey,
    });
    return jsonWithRequestId(request, result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payment failed";
    return errorResponse(request, { status: 400, code: "payment_failed", message });
  }
}
