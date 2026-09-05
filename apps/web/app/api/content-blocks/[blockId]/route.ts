import { NextResponse, type NextRequest } from "next/server";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import {
  deleteContentBlock,
  duplicateContentBlock,
  getContentBlock,
  setContentBlockShares,
  updateContentBlock,
} from "@/lib/editor/content-block-store";
import type { EditorDoc } from "@/lib/editor/types";

type Params = { params: Promise<{ blockId: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  const { blockId } = await params;
  const block = await getContentBlock(blockId, auth.workspaceId);
  if (!block) {
    return NextResponse.json({ error: "Content block not found" }, { status: 404 });
  }
  return NextResponse.json({ block });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const { blockId } = await params;
  const payload = (await request.json()) as {
    name?: string;
    block_type?: string;
    editor_json?: EditorDoc;
    folder_id?: string | null;
    shareUserIds?: string[];
    duplicate?: boolean;
  };

  if (payload.duplicate) {
    const block = await duplicateContentBlock({
      blockId,
      workspaceId: auth.workspaceId,
      createdBy: auth.userId,
      name: payload.name,
    });
    if (!block) {
      return NextResponse.json({ error: "Content block not found" }, { status: 404 });
    }
    return NextResponse.json({ block }, { status: 201 });
  }

  if (Array.isArray(payload.shareUserIds)) {
    const block = await setContentBlockShares({
      blockId,
      workspaceId: auth.workspaceId,
      userIds: payload.shareUserIds,
    });
    if (!block) {
      return NextResponse.json({ error: "Content block not found" }, { status: 404 });
    }
    return NextResponse.json({ block });
  }

  const block = await updateContentBlock(blockId, auth.workspaceId, {
    ...payload,
    updatedBy: auth.userId,
  });
  if (!block) {
    return NextResponse.json({ error: "Content block not found" }, { status: 404 });
  }
  return NextResponse.json({ block });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const { blockId } = await params;
  const ok = await deleteContentBlock(blockId, auth.workspaceId);
  if (!ok) {
    return NextResponse.json({ error: "Content block not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
