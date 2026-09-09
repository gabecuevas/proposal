import type { NextRequest } from "next/server";
import { parseCursorPagination, getNextCursorFromTimestampPage } from "@/lib/api/pagination";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { createTemplate, listTemplates } from "@/lib/editor/template-store";
import type { EditorDoc } from "@/lib/editor/types";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const pagination = parseCursorPagination(request, 20);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? undefined;
  const tag = url.searchParams.get("tag") ?? undefined;
  const folderParam = url.searchParams.get("folderId");
  const folderId =
    folderParam === null ? undefined : folderParam === "root" || folderParam === "" ? null : folderParam;
  const templates = await listTemplates(auth.workspaceId, {
    limit: pagination.limit + 1,
    before: pagination.before,
    query: q,
    tag,
    folderId,
  });
  const page = getNextCursorFromTimestampPage(templates, pagination.limit, (item) => item.created_at ?? new Date());
  return jsonWithRequestId(request, { templates: page.items, nextCursor: page.nextCursor });
}

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");

  const payload = (await request.json()) as {
    name?: string;
    editor_json?: EditorDoc;
    tags?: string[];
    folder_id?: string | null;
  };
  try {
    const template = await createTemplate({
      name: payload.name?.trim() || "Untitled Template",
      workspaceId: auth.workspaceId,
      createdBy: auth.userId,
      editor_json: payload.editor_json,
      tags: Array.isArray(payload.tags) ? payload.tags.map(String).slice(0, 20) : undefined,
      folder_id: payload.folder_id,
    });
    return jsonWithRequestId(request, { template }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message === "Forbidden" ? "Forbidden" : "Failed to create template";
    return errorResponse(request, {
      status: message === "Forbidden" ? 403 : 500,
      code: message === "Forbidden" ? "forbidden" : "template_create_failed",
      message: message === "Forbidden" ? "You do not have permission to create templates." : "Failed to create template",
    });
  }
}
