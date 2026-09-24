import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import {
  getConversationForCustomer,
  markRead,
  postPublicMessage,
} from "@/lib/support/conversations";
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
  return jsonWithRequestId(request, { messages: conversation.messages ?? [] });
}

export async function POST(request: NextRequest, { params }: Params) {
  const session = await requireSupportCustomer(request);
  if (isCustomerSessionError(session)) {
    return session;
  }
  const { id } = await params;
  const existing = await getConversationForCustomer(id, session.userId);
  if (!existing) {
    return errorResponse(request, {
      status: 404,
      code: "not_found",
      message: "Conversation not found",
    });
  }

  const body = (await request.json()) as {
    body?: string;
    clientOpId?: string;
    markReadSequence?: number;
  };

  if (body.markReadSequence !== undefined) {
    const read = await markRead({
      userId: session.userId,
      conversationId: id,
      sequence: body.markReadSequence,
      role: "customer",
    });
    return jsonWithRequestId(request, { read });
  }

  const text = body.body?.trim();
  if (!text) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "body is required",
    });
  }

  try {
    const message = await postPublicMessage({
      conversationId: id,
      senderUserId: session.userId,
      bodyText: text,
      clientOpId: body.clientOpId,
      fromAdmin: false,
    });
    return jsonWithRequestId(request, { message }, { status: 201 });
  } catch {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Unable to post message",
    });
  }
}
