import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";

type Params = { params: Promise<{ documentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  const { documentId } = await params;

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      workspace_id: auth.workspaceId,
    },
    select: {
      id: true,
      status: true,
      created_at: true,
      updated_at: true,
    },
  });
  if (!document) {
    return errorResponse(request, {
      status: 404,
      code: "document_not_found",
      message: "Document not found",
    });
  }

  const [activity, webhookDeliveries, payments] = await Promise.all([
    prisma.documentActivityEvent.findMany({
      where: {
        workspace_id: auth.workspaceId,
        document_id: documentId,
        event_type: {
          in: ["DOCUMENT_SENT", "DOCUMENT_VIEWED", "DOCUMENT_FINALIZED", "DOCUMENT_PDF_STORED"],
        },
      },
      orderBy: [{ created_at: "asc" }],
      select: {
        event_type: true,
        created_at: true,
      },
    }),
    prisma.webhookDelivery.groupBy({
      by: ["status"],
      where: {
        workspace_id: auth.workspaceId,
        document_id: documentId,
      },
      _count: { _all: true },
    }),
    prisma.documentPayment.findMany({
      where: {
        workspace_id: auth.workspaceId,
        document_id: documentId,
      },
      select: {
        id: true,
        status: true,
        amount_minor: true,
        currency: true,
        created_at: true,
        paid_at: true,
      },
      orderBy: [{ created_at: "desc" }],
      take: 25,
    }),
  ]);

  const sentAt = activity.find((event) => event.event_type === "DOCUMENT_SENT")?.created_at ?? null;
  const viewedAt = activity.find((event) => event.event_type === "DOCUMENT_VIEWED")?.created_at ?? null;
  const finalizedAt = activity.find((event) => event.event_type === "DOCUMENT_FINALIZED")?.created_at ?? null;
  const pdfStoredAt = activity.find((event) => event.event_type === "DOCUMENT_PDF_STORED")?.created_at ?? null;

  const sentToFinalizedMs =
    sentAt && finalizedAt ? Math.max(0, finalizedAt.getTime() - sentAt.getTime()) : null;
  const viewedToFinalizedMs =
    viewedAt && finalizedAt ? Math.max(0, finalizedAt.getTime() - viewedAt.getTime()) : null;

  return jsonWithRequestId(request, {
    analytics: {
      document: {
        id: document.id,
        status: document.status,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
      },
      timeline: {
        sentAt,
        viewedAt,
        finalizedAt,
        pdfStoredAt,
      },
      durationsMs: {
        sentToFinalizedMs,
        viewedToFinalizedMs,
      },
      webhookDeliveries: webhookDeliveries.map((row) => ({
        status: row.status,
        count: row._count._all,
      })),
      payments: payments.map((payment) => ({
        id: payment.id,
        status: payment.status,
        amountMinor: payment.amount_minor,
        currency: payment.currency,
        createdAt: payment.created_at,
        paidAt: payment.paid_at,
      })),
    },
  });
}
