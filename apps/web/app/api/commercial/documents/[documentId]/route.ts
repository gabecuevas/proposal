import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import {
  CommercialConflictError,
  CommercialImmutableError,
  getCommercialDocument,
  updateCommercialDocument,
} from "@/lib/commercial/store";
import { parseCommercialDocument } from "@/lib/commercial/parse";

type Params = { params: Promise<{ documentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  const { documentId } = await params;
  const document = await getCommercialDocument(documentId, auth.workspaceId);
  if (!document) {
    return errorResponse(request, { status: 404, code: "not_found", message: "Document not found" });
  }
  return jsonWithRequestId(request, { document });
}

type PatchBody = {
  expectedVersion?: number;
  commercial?: unknown;
};

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const { documentId } = await params;
  const body = (await request.json().catch(() => ({}))) as PatchBody;
  const commercial = parseCommercialDocument(body.commercial);
  if (!commercial || typeof body.expectedVersion !== "number") {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "commercial payload and expectedVersion are required",
    });
  }

  try {
    const document = await updateCommercialDocument({
      documentId,
      workspaceId: auth.workspaceId,
      actorUserId: auth.userId,
      expectedVersion: body.expectedVersion,
      commercial,
    });
    return jsonWithRequestId(request, { document });
  } catch (error) {
    if (error instanceof CommercialConflictError) {
      return errorResponse(request, { status: 409, code: "version_conflict", message: error.message });
    }
    if (error instanceof CommercialImmutableError) {
      return errorResponse(request, { status: 409, code: "immutable", message: error.message });
    }
    const message = error instanceof Error ? error.message : "Save failed";
    if (message === "Document not found") {
      return errorResponse(request, { status: 404, code: "not_found", message });
    }
    return errorResponse(request, { status: 400, code: "save_failed", message });
  }
}
