import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { getConversationForCustomer } from "@/lib/support/conversations";
import { isCustomerSessionError, requireSupportCustomer } from "@/lib/support/customer-api";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const session = await requireSupportCustomer(request);
  if (isCustomerSessionError(session)) {
    return session;
  }
  const { id } = await params;
  const conversation = await getConversationForCustomer(id, session.userId);
  if (!conversation) {
    return errorResponse(request, {
      status: 404,
      code: "not_found",
      message: "Conversation not found",
    });
  }
  return jsonWithRequestId(request, { conversation });
}
