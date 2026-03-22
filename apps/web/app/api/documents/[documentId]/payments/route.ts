import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { getDocument } from "@/lib/editor/document-store";

type Params = { params: Promise<{ documentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  const { documentId } = await params;
  const document = await getDocument(documentId, auth.workspaceId);
  if (!document) {
    return errorResponse(request, {
      status: 404,
      code: "document_not_found",
      message: "Document not found",
    });
  }

  const payments = await prisma.documentPayment.findMany({
    where: {
      workspace_id: auth.workspaceId,
      document_id: documentId,
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: 50,
  });

  return jsonWithRequestId(request, {
    payments: payments.map((row) => ({
      id: row.id,
      provider: row.provider,
      status: row.status,
      amount_minor: row.amount_minor,
      currency: row.currency,
      checkout_url: row.checkout_url,
      paid_at: row.paid_at?.toISOString() ?? null,
      created_at: row.created_at.toISOString(),
    })),
  });
}
