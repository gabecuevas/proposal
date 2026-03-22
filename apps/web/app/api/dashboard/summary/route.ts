import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";

const defaultStatuses = ["DRAFTED", "SENT", "VIEWED", "COMMENTED", "SIGNED", "PAID", "EXPIRED", "VOID"] as const;

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);

  const [statusCounts, recentDocuments, recentEvents] = await Promise.all([
    prisma.document.groupBy({
      by: ["status"],
      where: { workspace_id: auth.workspaceId },
      _count: { _all: true },
    }),
    prisma.document.findMany({
      where: { workspace_id: auth.workspaceId },
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      take: 8,
      select: {
        id: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    }),
    prisma.documentActivityEvent.findMany({
      where: { workspace_id: auth.workspaceId },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: 15,
      select: {
        id: true,
        document_id: true,
        event_type: true,
        created_at: true,
      },
    }),
  ]);

  const counts = Object.fromEntries(defaultStatuses.map((status) => [status, 0])) as Record<string, number>;
  for (const row of statusCounts) {
    counts[row.status] = row._count._all;
  }

  return jsonWithRequestId(request, {
    counts,
    recentDocuments: recentDocuments.map((document) => ({
      id: document.id,
      status: document.status,
      created_at: document.created_at.toISOString(),
      updated_at: document.updated_at.toISOString(),
    })),
    recentActivity: recentEvents.map((event) => ({
      id: event.id,
      document_id: event.document_id,
      event_type: event.event_type,
      created_at: event.created_at.toISOString(),
    })),
  });
}
