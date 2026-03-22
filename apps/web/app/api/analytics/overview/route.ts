import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { computeLifecycleMetrics, computeRevenueFromPaidDocuments } from "@/lib/analytics/metrics";
import type { PricingModel } from "@/lib/editor/types";

function parseDays(raw: string | null): number {
  const value = Number(raw ?? 30);
  if (!Number.isFinite(value)) {
    return 30;
  }
  return Math.min(365, Math.max(1, Math.trunc(value)));
}

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const url = new URL(request.url);
  const days = parseDays(url.searchParams.get("days"));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [lifecycleEvents, paidDocs, webhookStats, pdfQueueFailed, sentDocs, paymentStats] = await Promise.all([
    prisma.documentActivityEvent.findMany({
      where: {
        workspace_id: auth.workspaceId,
        event_type: {
          in: ["DOCUMENT_SENT", "DOCUMENT_VIEWED", "DOCUMENT_FINALIZED"],
        },
        created_at: { gte: since },
      },
      select: {
        document_id: true,
        event_type: true,
        created_at: true,
      },
      orderBy: [{ created_at: "desc" }],
      take: 5000,
    }),
    prisma.document.findMany({
      where: {
        workspace_id: auth.workspaceId,
        status: "PAID",
        updated_at: { gte: since },
      },
      select: {
        pricing_json: true,
      },
      take: 1000,
    }),
    prisma.webhookDelivery.groupBy({
      by: ["status"],
      where: {
        workspace_id: auth.workspaceId,
        created_at: { gte: since },
      },
      _count: { _all: true },
    }),
    prisma.documentActivityEvent.count({
      where: {
        workspace_id: auth.workspaceId,
        event_type: "DOCUMENT_PDF_JOB_QUEUE_FAILED",
        created_at: { gte: since },
      },
    }),
    prisma.documentActivityEvent.count({
      where: {
        workspace_id: auth.workspaceId,
        event_type: "DOCUMENT_SENT",
        created_at: { gte: since },
      },
    }),
    prisma.documentPayment.groupBy({
      by: ["status"],
      where: {
        workspace_id: auth.workspaceId,
        created_at: { gte: since },
      },
      _count: { _all: true },
      _sum: {
        amount_minor: true,
      },
    }),
  ]);

  const lifecycle = computeLifecycleMetrics(
    lifecycleEvents.map((event) => ({
      document_id: event.document_id,
      event_type: event.event_type as "DOCUMENT_SENT" | "DOCUMENT_VIEWED" | "DOCUMENT_FINALIZED",
      created_at: event.created_at,
    })),
  );
  const webhookTotal = webhookStats.reduce((sum, row) => sum + row._count._all, 0);
  const webhookDeadLetters = webhookStats.find((row) => row.status === "DEAD_LETTER")?._count._all ?? 0;
  const completedPayments = paymentStats.find((row) => row.status === "COMPLETED");
  const createdPayments = paymentStats.find((row) => row.status === "PENDING");

  return jsonWithRequestId(request, {
    range: {
      days,
      since: since.toISOString(),
    },
    metrics: {
      docsSent: sentDocs,
      avgTimeToSignMs: lifecycle.avgTimeToSignMs,
      viewToSignRate: lifecycle.viewToSignRate,
      paidRevenue: computeRevenueFromPaidDocuments(
        paidDocs.map((doc) => ({
          pricing_json: doc.pricing_json as PricingModel,
        })),
      ),
      webhookDeadLetterRate: webhookTotal > 0 ? webhookDeadLetters / webhookTotal : 0,
      webhookDeadLetters,
      webhookTotal,
      pdfQueueFailures: pdfQueueFailed,
      paymentsCreated: createdPayments?._count._all ?? 0,
      paymentsCompleted: completedPayments?._count._all ?? 0,
      paymentsCompletedAmount: (completedPayments?._sum.amount_minor ?? 0) / 100,
    },
  });
}
