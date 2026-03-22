import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { getNextCursorFromTimestampPage, parseCursorPagination } from "@/lib/api/pagination";
import { jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";

const WEBHOOK_STATUSES = new Set(["PENDING", "RETRYING", "SUCCESS", "DEAD_LETTER"]);

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const url = new URL(request.url);
  const pagination = parseCursorPagination(request, 50);
  const statusParam = url.searchParams.get("status")?.trim();
  const status = statusParam && WEBHOOK_STATUSES.has(statusParam) ? statusParam : undefined;
  const eventType = url.searchParams.get("eventType")?.trim() ?? undefined;
  const endpointId = url.searchParams.get("endpointId")?.trim() ?? undefined;
  const documentId = url.searchParams.get("documentId")?.trim() ?? undefined;

  const deliveries = await prisma.webhookDelivery.findMany({
    where: {
      workspace_id: auth.workspaceId,
      status: status as "PENDING" | "RETRYING" | "SUCCESS" | "DEAD_LETTER" | undefined,
      event_type: eventType,
      endpoint_id: endpointId,
      document_id: documentId,
      created_at: pagination.before ? { lt: pagination.before } : undefined,
    },
    include: {
      endpoint: {
        select: {
          id: true,
          url: true,
          is_active: true,
        },
      },
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: pagination.limit + 1,
  });

  const page = getNextCursorFromTimestampPage(deliveries, pagination.limit, (item) => item.created_at);
  return jsonWithRequestId(request, {
    deliveries: page.items,
    nextCursor: page.nextCursor,
  });
}
