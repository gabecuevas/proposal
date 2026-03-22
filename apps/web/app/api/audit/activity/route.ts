import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { getNextCursorFromTimestampPage, parseCursorPagination } from "@/lib/api/pagination";
import { jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const url = new URL(request.url);
  const pagination = parseCursorPagination(request, 50);
  const documentId = url.searchParams.get("documentId")?.trim() ?? undefined;
  const eventType = url.searchParams.get("eventType")?.trim() ?? undefined;
  const actorUserId = url.searchParams.get("actorUserId")?.trim() ?? undefined;
  const actorRecipientId = url.searchParams.get("actorRecipientId")?.trim() ?? undefined;
  const events = await prisma.documentActivityEvent.findMany({
    where: {
      workspace_id: auth.workspaceId,
      document_id: documentId,
      event_type: eventType,
      actor_user_id: actorUserId,
      actor_recipient_id: actorRecipientId,
      created_at: pagination.before ? { lt: pagination.before } : undefined,
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: pagination.limit + 1,
  });

  const page = getNextCursorFromTimestampPage(events, pagination.limit, (item) => item.created_at);
  return jsonWithRequestId(request, {
    events: page.items,
    nextCursor: page.nextCursor,
  });
}
