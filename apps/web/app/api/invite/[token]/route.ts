import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { hashOpaqueToken } from "@/lib/auth/auth-tokens";
import { buildSessionPayloadFromUser } from "@/lib/auth/session-builder";
import { jsonWithSessionCookie } from "@/lib/auth/session-cookie";
import { requireSessionFromRequest } from "@/lib/auth/session";
import { normalizeIdentityEmail } from "@/lib/auth/onboarding-schemas";

type RouteContext = { params: Promise<{ token: string }> };

async function findInvite(rawToken: string) {
  const tokenHash = hashOpaqueToken(rawToken);
  const byHash = await prisma.workspaceInvite.findFirst({
    where: { invite_token_hash: tokenHash },
    include: { workspace: { select: { id: true, name: true } } },
  });
  if (byHash) {
    return byHash;
  }
  return prisma.workspaceInvite.findFirst({
    where: { invite_token: rawToken },
    include: { workspace: { select: { id: true, name: true } } },
  });
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { token } = await context.params;
  const invite = await findInvite(token);
  if (!invite || invite.revoked_at || invite.accepted_at) {
    return errorResponse(request, {
      status: 404,
      code: "invite_not_found",
      message: "This invitation is no longer valid.",
    });
  }
  if (invite.expires_at.getTime() <= Date.now()) {
    return errorResponse(request, {
      status: 410,
      code: "invite_expired",
      message: "This invitation has expired.",
    });
  }

  return jsonWithRequestId(request, {
    invite: {
      email: invite.email,
      role: invite.role,
      workspaceName: invite.workspace.name,
      expiresAt: invite.expires_at.toISOString(),
    },
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = await requireSessionFromRequest(request);
  if (!session) {
    return errorResponse(request, {
      status: 401,
      code: "unauthorized",
      message: "Sign in to accept this invitation.",
    });
  }

  const { token } = await context.params;
  const invite = await findInvite(token);
  if (!invite || invite.revoked_at || invite.accepted_at) {
    return errorResponse(request, {
      status: 404,
      code: "invite_not_found",
      message: "This invitation is no longer valid.",
    });
  }
  if (invite.expires_at.getTime() <= Date.now()) {
    return errorResponse(request, {
      status: 410,
      code: "invite_expired",
      message: "This invitation has expired.",
    });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return errorResponse(request, { status: 401, code: "unauthorized", message: "Unauthorized" });
  }

  const sessionEmail = normalizeIdentityEmail(user.email);
  const inviteEmail = normalizeIdentityEmail(invite.email);
  if (sessionEmail !== inviteEmail) {
    return errorResponse(request, {
      status: 403,
      code: "email_mismatch",
      message: "Sign in with the invited email address to accept.",
    });
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.workspaceMember.findFirst({
      where: { workspace_id: invite.workspace_id, user_id: user.id },
    });
    if (!existing) {
      await tx.workspaceMember.create({
        data: {
          workspace_id: invite.workspace_id,
          user_id: user.id,
          role: invite.role,
        },
      });
    }
    await tx.workspaceInvite.update({
      where: { id: invite.id },
      data: { accepted_at: new Date() },
    });
    if (!user.default_workspace_id) {
      await tx.user.update({
        where: { id: user.id },
        data: { default_workspace_id: invite.workspace_id },
      });
    }
    await tx.userWorkspaceOnboarding.upsert({
      where: {
        user_id_workspace_id: {
          user_id: user.id,
          workspace_id: invite.workspace_id,
        },
      },
      create: {
        user_id: user.id,
        workspace_id: invite.workspace_id,
        team_step_skipped_at: new Date(),
      },
      update: {},
    });
  });

  const refreshedUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  const payload = await buildSessionPayloadFromUser(refreshedUser, invite.workspace_id);
  return jsonWithSessionCookie(request, { accepted: true, redirectHint: "/app" }, payload);
}
