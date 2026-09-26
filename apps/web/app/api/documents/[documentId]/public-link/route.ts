import type { NextRequest } from "next/server";
import { prisma } from "@repo/db";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { getCanonicalAppOrigin } from "@/lib/auth/app-origin";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { publicDocumentUrl } from "@/lib/documents/public-link";

type Params = { params: Promise<{ documentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  const { documentId } = await params;
  const document = await prisma.document.findFirst({
    where: { id: documentId, workspace_id: auth.workspaceId },
    select: { id: true },
  });
  if (!document) {
    return errorResponse(request, { status: 404, code: "not_found", message: "Document not found" });
  }
  return jsonWithRequestId(request, { url: publicDocumentUrl(document.id, getCanonicalAppOrigin(request)) });
}
