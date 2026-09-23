import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";

type RouteContext = { params: Promise<{ inviteId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  let auth;
  try {
    auth = await getRequestAuthContext(request);
    assertRole(auth, "ADMIN");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    return errorResponse(request, {
      status: message === "Forbidden" ? 403 : 401,
      code: message === "Forbidden" ? "forbidden" : "unauthorized",
      message: message === "Forbidden" ? "Forbidden" : "Unauthorized",
    });
  }

  const { inviteId } = await context.params;
  const invite = await prisma.workspaceInvite.findFirst({
    where: { id: inviteId, workspace_id: auth.workspaceId, revoked_at: null, accepted_at: null },
  });
  if (!invite) {
    return errorResponse(request, { status: 404, code: "not_found", message: "Invite not found" });
  }

  await prisma.workspaceInvite.update({
    where: { id: invite.id },
    data: { revoked_at: new Date() },
  });

  return jsonWithRequestId(request, { revoked: true });
}
