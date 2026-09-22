import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { convertQuoteToInvoice, saveCommercialAsTemplate } from "@/lib/commercial/store";

type Params = { params: Promise<{ documentId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const { documentId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    name?: string;
    description?: string;
    folderId?: string | null;
    dueDate?: string | null;
  };

  try {
    if (body.action === "save_template") {
      if (!body.name?.trim()) {
        return errorResponse(request, {
          status: 400,
          code: "validation_error",
          message: "Template name is required",
        });
      }
      const result = await saveCommercialAsTemplate({
        documentId,
        workspaceId: auth.workspaceId,
        actorUserId: auth.userId,
        name: body.name,
        description: body.description,
        folderId: body.folderId,
      });
      return jsonWithRequestId(request, result, { status: 201 });
    }

    if (body.action === "convert_to_invoice") {
      const document = await convertQuoteToInvoice({
        quoteDocumentId: documentId,
        workspaceId: auth.workspaceId,
        actorUserId: auth.userId,
        dueDate: body.dueDate,
      });
      return jsonWithRequestId(request, { document }, { status: 201 });
    }

    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Unknown action",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Action failed";
    if (message === "Document not found" || message === "Template not found") {
      return errorResponse(request, { status: 404, code: "not_found", message });
    }
    return errorResponse(request, { status: 400, code: "action_failed", message });
  }
}
