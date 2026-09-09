import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";

export async function GET(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  const workspace = await prisma.workspace.findUnique({
    where: { id: auth.workspaceId },
    select: { id: true, name: true },
  });
  if (!workspace) {
    return errorResponse(request, {
      status: 404,
      code: "workspace_not_found",
      message: "Workspace not found",
    });
  }
  return jsonWithRequestId(request, { workspace });
}

export async function PATCH(request: NextRequest) {
  const auth = await getRequestAuthContext(request);
  assertRole(auth, "ADMIN");
  const body = (await request.json()) as { name?: string };
  if (!body.name?.trim()) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "name is required",
    });
  }
  const workspace = await prisma.workspace.update({
    where: { id: auth.workspaceId },
    data: { name: body.name.trim() },
    select: { id: true, name: true },
  });
  return jsonWithRequestId(request, { workspace });
}
