import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import {
  getConversationForAdmin,
  markRead,
  postInternalNote,
  postPublicMessage,
} from "@/lib/support/conversations";
import { isErrorResponse, requirePlatformAdmin } from "@/lib/support/platform-admin";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }
  const { id } = await params;
  const conversation = await getConversationForAdmin(id);
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
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }
  const { id } = await params;
  const body = (await request.json()) as {
    body?: string;
    visibility?: "PUBLIC" | "INTERNAL";
    clientOpId?: string;
    markReadSequence?: number;
  };

  if (body.markReadSequence !== undefined) {
    const read = await markRead({
      userId: admin.userId,
      conversationId: id,
      sequence: body.markReadSequence,
      role: "admin",
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
    const message =
      body.visibility === "INTERNAL"
        ? await postInternalNote({
            conversationId: id,
            adminUserId: admin.userId,
            bodyText: text,
            clientOpId: body.clientOpId,
          })
        : await postPublicMessage({
            conversationId: id,
            senderUserId: admin.userId,
            bodyText: text,
            clientOpId: body.clientOpId,
            fromAdmin: true,
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
