import type { SupportConversationPriority } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import {
  reopenConversation,
  resolveConversation,
  setConversationPriority,
} from "@/lib/support/conversations";
import { isErrorResponse, requirePlatformAdmin } from "@/lib/support/platform-admin";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const admin = await requirePlatformAdmin(request);
  if (isErrorResponse(admin)) {
    return admin;
  }
  const { id } = await params;
  const body = (await request.json()) as {
    action?: "resolve" | "reopen";
    priority?: SupportConversationPriority;
  };

  if (body.priority) {
    const conversation = await setConversationPriority(id, body.priority);
    return jsonWithRequestId(request, { conversation });
  }

  if (body.action === "resolve") {
    const conversation = await resolveConversation(id);
    return jsonWithRequestId(request, { conversation });
  }
  if (body.action === "reopen") {
    const conversation = await reopenConversation(id);
    return jsonWithRequestId(request, { conversation });
  }

  return errorResponse(request, {
    status: 400,
    code: "validation_error",
    message: "action or priority is required",
  });
}
