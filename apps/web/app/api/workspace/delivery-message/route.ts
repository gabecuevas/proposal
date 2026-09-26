import type { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { isWorkflowDocumentKind } from "@/lib/editor/document-kind";

const MAX_MESSAGE_LENGTH = 10_000;

/** The signed-in user's saved Review & Send message for a document kind. */
export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const kind = request.nextUrl.searchParams.get("kind");
  if (!isWorkflowDocumentKind(kind)) {
    return errorResponse(request, { status: 400, code: "validation_error", message: "Unknown document kind" });
  }
  try {
    const saved = await prisma.deliveryMessageDefault.findUnique({
      where: { workspace_id_user_id_kind: { workspace_id: auth.workspaceId, user_id: auth.userId, kind } },
      select: { message: true, subject: true },
    });
    return jsonWithRequestId(request, { default: saved });
  } catch {
    return jsonWithRequestId(request, { default: null });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const body = (await request.json().catch(() => ({}))) as {
    kind?: unknown;
    message?: unknown;
    subject?: unknown;
  };
  if (!isWorkflowDocumentKind(body.kind)) {
    return errorResponse(request, { status: 400, code: "validation_error", message: "Unknown document kind" });
  }
  if (typeof body.message !== "string" || !body.message.trim() || body.message.length > MAX_MESSAGE_LENGTH) {
    return errorResponse(request, { status: 400, code: "validation_error", message: "Message is required" });
  }
  const subject = typeof body.subject === "string" ? body.subject.slice(0, 500) : null;
  try {
    const saved = await prisma.deliveryMessageDefault.upsert({
      where: {
        workspace_id_user_id_kind: { workspace_id: auth.workspaceId, user_id: auth.userId, kind: body.kind },
      },
      create: {
        workspace_id: auth.workspaceId,
        user_id: auth.userId,
        kind: body.kind,
        message: body.message,
        subject,
      },
      update: { message: body.message, subject },
      select: { message: true, subject: true },
    });
    return jsonWithRequestId(request, { default: saved });
  } catch {
    return errorResponse(request, {
      status: 503,
      code: "default_message_unavailable",
      message: "Could not save your default message",
    });
  }
}
