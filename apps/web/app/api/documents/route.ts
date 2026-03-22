import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { getNextCursorFromTimestampPage, parseCursorPagination } from "@/lib/api/pagination";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { createBlankDocument, createDocumentFromTemplate, listDocuments } from "@/lib/editor/document-store";

const validStatuses = [
  "DRAFTED",
  "SENT",
  "VIEWED",
  "COMMENTED",
  "SIGNED",
  "PAID",
  "EXPIRED",
  "VOID",
] as const;
type DocumentStatus = (typeof validStatuses)[number];

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const pagination = parseCursorPagination(request, 50);
  const url = new URL(request.url);
  const statusRaw = url.searchParams.get("status")?.toUpperCase();
  const q = url.searchParams.get("q") ?? undefined;
  const status = statusRaw && validStatuses.includes(statusRaw as DocumentStatus)
    ? (statusRaw as DocumentStatus)
    : undefined;
  const documents = await listDocuments(auth.workspaceId, {
    limit: pagination.limit + 1,
    before: pagination.before,
    status,
    query: q,
  });
  const page = getNextCursorFromTimestampPage(documents, pagination.limit, (item) => item.updated_at);
  return jsonWithRequestId(request, { documents: page.items, nextCursor: page.nextCursor });
}

type CreateDocumentBody = {
  templateId?: string;
};

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const body = (await request.json().catch(() => ({}))) as CreateDocumentBody;

  try {
    const document = body.templateId
      ? await createDocumentFromTemplate(body.templateId, auth.workspaceId)
      : await createBlankDocument({
          workspaceId: auth.workspaceId,
          actorUserId: auth.userId,
        });
    return jsonWithRequestId(request, { document }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create document";
    if (message === "Template not found") {
      return errorResponse(request, {
        status: 404,
        code: "template_not_found",
        message,
      });
    }
    return errorResponse(request, {
      status: 500,
      code: "document_create_failed",
      message: "Failed to create document",
    });
  }
}
