import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import {
  createConversation,
  customerUnreadTotal,
  listCustomerConversations,
} from "@/lib/support/conversations";
import { isCustomerSessionError, requireSupportCustomer } from "@/lib/support/customer-api";

export async function GET(request: NextRequest) {
  const session = await requireSupportCustomer(request);
  if (isCustomerSessionError(session)) {
    return session;
  }
  const conversations = await listCustomerConversations(session.userId);
  const unreadTotal = await customerUnreadTotal(session.userId);
  return jsonWithRequestId(request, { conversations, unreadTotal });
}

export async function POST(request: NextRequest) {
  const session = await requireSupportCustomer(request);
  if (isCustomerSessionError(session)) {
    return session;
  }
  const body = (await request.json()) as {
    subject?: string;
    message?: string;
    clientOpId?: string;
    workspaceId?: string;
  };
  const message = body.message?.trim();
  if (!message) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "message is required",
    });
  }
  const conversation = await createConversation({
    customerUserId: session.userId,
    workspaceId: body.workspaceId ?? session.workspaceId ?? null,
    subject: body.subject?.trim() || "Support request",
    initialBody: message,
    senderUserId: session.userId,
    clientOpId: body.clientOpId,
    source: "messenger",
  });
  return jsonWithRequestId(request, { conversation }, { status: 201 });
}
