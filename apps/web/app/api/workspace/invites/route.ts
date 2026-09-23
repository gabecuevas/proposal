import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { INVITE_TTL_MS } from "@/lib/auth/auth-tokens";
import { createInviteTokenPair, sendWorkspaceInviteEmail } from "@/lib/auth/invite-mail";
import { normalizeIdentityEmail, inviteRowSchema } from "@/lib/auth/onboarding-schemas";
import { assertRole, getRequestAuthContext } from "@/lib/auth/request-context";

const createSchema = z.object({
  invites: z.array(inviteRowSchema).min(1).max(20),
});

export async function GET(request: NextRequest) {
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

  const invites = await prisma.workspaceInvite.findMany({
    where: { workspace_id: auth.workspaceId, revoked_at: null, accepted_at: null },
    orderBy: { created_at: "desc" },
    select: {
      id: true,
      email: true,
      role: true,
      expires_at: true,
      delivery_status: true,
      last_sent_at: true,
      created_at: true,
    },
  });

  return jsonWithRequestId(request, {
    invites: invites.map((row) => ({
      id: row.id,
      email: row.email,
      role: row.role,
      expiresAt: row.expires_at.toISOString(),
      deliveryStatus: row.delivery_status,
      lastSentAt: row.last_sent_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
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

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: parsed.error.issues[0]?.message ?? "Invalid invite payload",
    });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: auth.workspaceId },
    select: { name: true },
  });
  const inviter = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { name: true },
  });

  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const created: string[] = [];

  for (const row of parsed.data.invites) {
    const email = normalizeIdentityEmail(row.email);
    const member = await prisma.workspaceMember.findFirst({
      where: { workspace_id: auth.workspaceId, user: { email } },
    });
    if (member) {
      continue;
    }

    const { rawToken, tokenHash } = createInviteTokenPair();
    const invite = await prisma.workspaceInvite.create({
      data: {
        workspace_id: auth.workspaceId,
        email,
        role: row.role,
        invite_token_hash: tokenHash,
        invited_by: auth.userId,
        expires_at: expiresAt,
        last_sent_at: new Date(),
      },
    });
    created.push(invite.id);

    await sendWorkspaceInviteEmail({
      inviteId: invite.id,
      toEmail: email,
      inviterName: inviter?.name ?? "A teammate",
      companyName: workspace?.name ?? "your workspace",
      rawToken,
      request,
    });
  }

  return jsonWithRequestId(request, { createdInviteIds: created }, { status: 201 });
}
