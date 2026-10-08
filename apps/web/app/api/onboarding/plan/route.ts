import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/api/response";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { requireSessionOnly } from "@/lib/auth/require-session";
import { buildSessionPayloadFromUser, postAuthRedirectPath } from "@/lib/auth/session-builder";
import { jsonWithSessionCookie } from "@/lib/auth/session-cookie";

const bodySchema = z.object({ plan: z.literal("trial") });

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
  if (session.role !== "OWNER") {
    return errorResponse(request, {
      status: 403,
      code: "forbidden",
      message: "Only the workspace owner can choose a plan.",
    });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Choose a plan to continue.",
    });
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: session.workspaceId },
    select: { plan_selected_at: true, trial_ends_at: true },
  });
  if (!workspace) {
    return errorResponse(request, { status: 404, code: "not_found", message: "Workspace not found" });
  }

  const now = new Date();
  if (!workspace.plan_selected_at) {
    await prisma.workspace.update({
      where: { id: session.workspaceId },
      data: {
        plan: "trial",
        plan_selected_at: now,
        trial_ends_at: workspace.trial_ends_at ?? new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
        seat_limit: 1,
      },
    });
  }

  // The trial is single-user, so there is no one to invite.
  await prisma.userWorkspaceOnboarding.upsert({
    where: {
      user_id_workspace_id: { user_id: session.userId, workspace_id: session.workspaceId },
    },
    create: {
      user_id: session.userId,
      workspace_id: session.workspaceId,
      team_step_skipped_at: now,
    },
    update: { team_step_skipped_at: now },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: session.userId } });
  const payload = await buildSessionPayloadFromUser(user);
  return jsonWithSessionCookie(
    request,
    { ok: true, redirectHint: postAuthRedirectPath(payload) },
    payload,
  );
}
