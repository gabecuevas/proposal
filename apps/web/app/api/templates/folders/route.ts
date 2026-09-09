import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";
import {
  createTemplateFolder,
  deleteTemplateFolder,
  listAllTemplateFolders,
  listTemplateFolders,
  renameTemplateFolder,
  setFolderShares,
} from "@/lib/editor/template-store";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const url = new URL(request.url);
  if (url.searchParams.get("all") === "1") {
    const folders = await listAllTemplateFolders(auth.workspaceId);
    return jsonWithRequestId(request, { folders });
  }
  const parentId = url.searchParams.get("parentId");
  const folders = await listTemplateFolders(auth.workspaceId, parentId === "root" || !parentId ? null : parentId);
  return jsonWithRequestId(request, { folders });
}

export async function POST(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const payload = (await request.json().catch(() => null)) as
    | { name?: string; parentId?: string | null }
    | null;
  if (!payload?.name?.trim()) {
    return errorResponse(request, {
      status: 400,
      code: "invalid_name",
      message: "Folder name is required",
    });
  }
  const folder = await createTemplateFolder({
    workspaceId: auth.workspaceId,
    createdBy: auth.userId,
    name: payload.name,
    parentId: payload.parentId ?? null,
  });
  return jsonWithRequestId(request, { folder }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const payload = (await request.json().catch(() => null)) as
    | { folderId?: string; name?: string; shareUserIds?: string[] }
    | null;
  if (!payload?.folderId) {
    return errorResponse(request, {
      status: 400,
      code: "missing_folder",
      message: "folderId is required",
    });
  }
  if (Array.isArray(payload.shareUserIds)) {
    const folder = await setFolderShares({
      folderId: payload.folderId,
      workspaceId: auth.workspaceId,
      userIds: payload.shareUserIds,
    });
    if (!folder) {
      return errorResponse(request, { status: 404, code: "not_found", message: "Folder not found" });
    }
    return jsonWithRequestId(request, { folder });
  }
  if (!payload.name?.trim()) {
    return errorResponse(request, {
      status: 400,
      code: "invalid_name",
      message: "Folder name is required",
    });
  }
  const folder = await renameTemplateFolder({
    folderId: payload.folderId,
    workspaceId: auth.workspaceId,
    name: payload.name,
  });
  if (!folder) {
    return errorResponse(request, { status: 404, code: "not_found", message: "Folder not found" });
  }
  return jsonWithRequestId(request, { folder });
}

export async function DELETE(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "MEMBER");
  const folderId = new URL(request.url).searchParams.get("folderId");
  if (!folderId) {
    return errorResponse(request, {
      status: 400,
      code: "missing_folder",
      message: "folderId is required",
    });
  }
  const ok = await deleteTemplateFolder({ folderId, workspaceId: auth.workspaceId });
  if (!ok) {
    return errorResponse(request, { status: 404, code: "not_found", message: "Folder not found" });
  }
  return jsonWithRequestId(request, { ok: true });
}
