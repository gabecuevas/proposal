import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api/response";
import { INVITE_TTL_MS } from "@/lib/auth/auth-tokens";
import { createInviteTokenPair, sendWorkspaceInviteEmail } from "@/lib/auth/invite-mail";
import { normalizeIdentityEmail, teamInviteSchema } from "@/lib/auth/onboarding-schemas";
import { requireSessionOnly } from "@/lib/auth/require-session";
import { buildSessionPayloadFromUser } from "@/lib/auth/session-builder";
import { jsonWithSessionCookie } from "@/lib/auth/session-cookie";

const bodySchema = z.union([z.object({ skip: z.literal(true) }), teamInviteSchema]);

export async function POST(request: NextRequest) {
  const session = await requireSessionOnly(request);
  if ("status" in session) {
    return session;
  }

  if (!session.workspaceId || !session.companySetupComplete) {
    return errorResponse(request, {
      status: 403,
      code: "forbidden",
      message: "Complete company setup first.",
    });
  }

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "Invalid team step payload",
    });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.workspaceId },
    select: { id: true, name: true },
  });
  if (!workspace) {
    return errorResponse(request, { status: 404, code: "not_found", message: "Workspace not found" });
  }

  const inviter = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { name: true },
  });

  if ("skip" in parsed.data && parsed.data.skip) {
    await prisma.userWorkspaceOnboarding.upsert({
      where: {
        user_id_workspace_id: {
          user_id: session.userId,
          workspace_id: session.workspaceId,
        },
      },
      create: {
        user_id: session.userId,
        workspace_id: session.workspaceId,
        team_step_skipped_at: new Date(),
      },
      update: { team_step_skipped_at: new Date() },
    });
  } else if ("invites" in parsed.data) {
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    for (const row of parsed.data.invites) {
      const email = normalizeIdentityEmail(row.email);
      const existingMember = await prisma.workspaceMember.findFirst({
        where: {
          workspace_id: session.workspaceId,
          user: { email },
        },
      });
      if (existingMember) {
        continue;
      }

      const { rawToken, tokenHash } = createInviteTokenPair();
      const pending = await prisma.workspaceInvite.findFirst({
        where: {
          workspace_id: session.workspaceId,
          email,
          revoked_at: null,
          accepted_at: null,
        },
      });

      const invite = pending
        ? await prisma.workspaceInvite.update({
            where: { id: pending.id },
            data: {
              role: row.role,
              invite_token_hash: tokenHash,
              expires_at: expiresAt,
              delivery_status: "pending",
              last_sent_at: new Date(),
            },
          })
        : await prisma.workspaceInvite.create({
            data: {
              workspace_id: session.workspaceId,
              email,
              role: row.role,
              invite_token_hash: tokenHash,
              invited_by: session.userId,
              expires_at: expiresAt,
              last_sent_at: new Date(),
            },
          });

      await sendWorkspaceInviteEmail({
        inviteId: invite.id,
        toEmail: email,
        inviterName: inviter?.name ?? "A teammate",
        companyName: workspace.name,
        rawToken,
        request,
      });
    }

    await prisma.userWorkspaceOnboarding.upsert({
      where: {
        user_id_workspace_id: {
          user_id: session.userId,
          workspace_id: session.workspaceId,
        },
      },
      create: {
        user_id: session.userId,
        workspace_id: session.workspaceId,
        team_step_completed_at: new Date(),
      },
      update: { team_step_completed_at: new Date() },
    });
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const payload = await buildSessionPayloadFromUser(user);
  return jsonWithSessionCookie(request, { ok: true }, payload);
}
