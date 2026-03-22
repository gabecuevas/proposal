import { NextResponse, type NextRequest } from "next/server";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import { bumpContentBlockVersion } from "@/lib/editor/content-block-store";
import type { EditorDoc } from "@/lib/editor/types";

type Params = { params: Promise<{ blockId: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");

  const { blockId } = await params;
  const payload = (await request.json()) as { editor_json: EditorDoc };
  const block = await bumpContentBlockVersion(blockId, auth.workspaceId, payload.editor_json);
  if (!block) {
    return NextResponse.json({ error: "Content block not found" }, { status: 404 });
  }
  return NextResponse.json({ block });
}
