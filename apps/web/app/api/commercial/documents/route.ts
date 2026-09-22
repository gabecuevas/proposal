import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import {
  CommercialConflictError,
  CommercialImmutableError,
  createCommercialDraft,
} from "@/lib/commercial/store";
import type { CommercialDocType } from "@/lib/commercial/schema";

type Body = {
  type?: string;
  templateId?: string;
  idempotencyKey?: string;
};

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const body = (await request.json().catch(() => ({}))) as Body;
  const type: CommercialDocType = body.type === "invoice" ? "invoice" : "quote";

  try {
    const document = await createCommercialDraft({
      workspaceId: auth.workspaceId,
      actorUserId: auth.userId,
      type,
      templateId: body.templateId ?? null,
      idempotencyKey: body.idempotencyKey ?? null,
    });
    return jsonWithRequestId(request, { document }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create document";
    if (message === "Template not found") {
      return errorResponse(request, { status: 404, code: "not_found", message });
    }
    if (error instanceof CommercialConflictError || error instanceof CommercialImmutableError) {
      return errorResponse(request, { status: 409, code: "conflict", message: error.message });
    }
    return errorResponse(request, { status: 400, code: "create_failed", message });
  }
}
