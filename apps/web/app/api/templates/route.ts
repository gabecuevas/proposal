import type { NextRequest } from "next/server";
import { parseCursorPagination, getNextCursorFromTimestampPage } from "@/lib/api/pagination";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { createTemplate, listTemplates } from "@/lib/editor/template-store";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const pagination = parseCursorPagination(request, 20);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const tag = url.searchParams.get("tag") ?? undefined;
  const templates = await listTemplates(auth.workspaceId, {
    limit: pagination.limit + 1,
    before: pagination.before,
    query: q,
    tag,
  });
  const page = getNextCursorFromTimestampPage(templates, pagination.limit, (item) => item.created_at ?? new Date());
  return jsonWithRequestId(request, { templates: page.items, nextCursor: page.nextCursor });
}

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");

  const payload = (await request.json()) as { name?: string };
  try {
    const template = await createTemplate({
      name: payload.name?.trim() || "Untitled Template",
      workspaceId: auth.workspaceId,
      createdBy: auth.userId,
    });
    return jsonWithRequestId(request, { template }, { status: 201 });
  } catch {
    return errorResponse(request, {
      status: 500,
      code: "template_create_failed",
      message: "Failed to create template",
    });
  }
}
