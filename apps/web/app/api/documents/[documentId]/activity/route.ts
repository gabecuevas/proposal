import type { NextRequest } from "next/server";
import { getNextCursorFromTimestampPage, parseCursorPagination } from "@/lib/api/pagination";
import { jsonWithRequestId } from "@/lib/api/response";
import { getRequestAuthContext } from "@/lib/auth/request-context";
import { listDocumentActivity } from "@/lib/editor/document-store";

type Params = { params: Promise<{ documentId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  const { documentId } = await params;
  const pagination = parseCursorPagination(request, 100);
  const events = await listDocumentActivity(documentId, auth.workspaceId, {
    limit: pagination.limit + 1,
    before: pagination.before,
  });
  const page = getNextCursorFromTimestampPage(events, pagination.limit, (item) => item.created_at);
  return jsonWithRequestId(request, { events: page.items, nextCursor: page.nextCursor });
}
