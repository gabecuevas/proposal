import type { NextRequest } from "next/server";
import { getNextCursorFromTimestampPage, parseCursorPagination } from "@/lib/api/pagination";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { createContentBlock, listContentBlocks } from "@/lib/editor/content-block-store";
import type { EditorDoc } from "@/lib/editor/types";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const pagination = parseCursorPagination(request, 50);
  const blocks = await listContentBlocks(auth.workspaceId, {
    limit: pagination.limit + 1,
    before: pagination.before,
  });
  const page = getNextCursorFromTimestampPage(blocks, pagination.limit, (item) => item.updated_at ?? new Date());
  return jsonWithRequestId(request, { blocks: page.items, nextCursor: page.nextCursor });
}

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");

  const payload = (await request.json()) as {
    name?: string;
    block_type?: string;
    editor_json?: EditorDoc;
  };

  try {
    const block = await createContentBlock({
      workspaceId: auth.workspaceId,
      name: payload.name?.trim() || "Untitled Block",
      block_type: payload.block_type?.trim() || "clause",
      editor_json: payload.editor_json,
    });
    return jsonWithRequestId(request, { block }, { status: 201 });
  } catch {
    return errorResponse(request, {
      status: 500,
      code: "content_block_create_failed",
      message: "Failed to create content block",
    });
  }
}
