import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { INVITE_TTL_MS } from "@/lib/auth/auth-tokens";
import { createInviteTokenPair, sendWorkspaceInviteEmail } from "@/lib/auth/invite-mail";
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
    include: { workspace: { select: { name: true } } },
  });
  if (!invite) {
    return errorResponse(request, { status: 404, code: "not_found", message: "Invite not found" });
  }

  const { rawToken, tokenHash } = createInviteTokenPair();
  await prisma.workspaceInvite.update({
    where: { id: invite.id },
    data: {
      invite_token_hash: tokenHash,
      expires_at: new Date(Date.now() + INVITE_TTL_MS),
      last_sent_at: new Date(),
      delivery_status: "pending",
    },
  });

  const inviter = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true },
  });

  await sendWorkspaceInviteEmail({
    inviteId: invite.id,
    toEmail: invite.email,
    inviterName: inviter?.name ?? "A teammate",
    companyName: invite.workspace.name,
    rawToken,
    request,
  });

  return jsonWithRequestId(request, { resent: true });
}
