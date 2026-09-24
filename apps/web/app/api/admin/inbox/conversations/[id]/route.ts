import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { getConversationForAdmin } from "@/lib/support/conversations";
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
  return jsonWithRequestId(request, { conversation });
}
