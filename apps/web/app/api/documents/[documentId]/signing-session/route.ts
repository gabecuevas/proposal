import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { signSigningSessionToken } from "@/lib/auth/signing-session";

type Params = { params: Promise<{ documentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const { documentId } = await params;
  const payload = (await request.json()) as { recipientId?: string };
  if (!payload.recipientId) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "recipientId is required",
    });
  }

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      workspace_id: auth.workspaceId,
    },
    include: {
      recipients: true,
    },
  });
  if (!document) {
    return errorResponse(request, {
      status: 404,
      code: "document_not_found",
      message: "Document not found",
    });
  }

  const recipient = document.recipients.find((item) => item.id === payload.recipientId);
  if (!recipient) {
    return errorResponse(request, {
      status: 404,
      code: "recipient_not_found",
      message: "Recipient not found on document",
    });
  }

  const token = await signSigningSessionToken({
    documentId,
    recipientId: recipient.id,
    workspaceId: auth.workspaceId,
    purpose: "signing",
  });
  const signingUrl = `/sign/${documentId}/${recipient.id}?token=${encodeURIComponent(token)}`;

  return jsonWithRequestId(request, {
    token,
    signingUrl,
    recipient: {
      id: recipient.id,
      email: recipient.email,
      name: recipient.name,
    },
  });
}
