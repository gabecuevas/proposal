import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { jsonWithRequestId } from "@/lib/api/response";
import { requireSessionOnly } from "@/lib/auth/require-session";

export async function GET(request: NextRequest) {
  const session = await requireSessionOnly(request);
  if ("status" in session) {
    return session;
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      email: true,
      pending_email: true,
      email_verified_at: true,
      provisional_company_name: true,
    },
  });

  let onboarding = null;
  if (session.workspaceId) {
    onboarding = await prisma.userWorkspaceOnboarding.findUnique({
      where: {
        user_id_workspace_id: {
          user_id: session.userId,
          workspace_id: session.workspaceId,
        },
      },
    });
  }

  const checklist = {
    accountCreated: true,
    emailVerified: Boolean(session.emailVerified),
    companySetup: Boolean(session.companySetupComplete),
    teamStep: Boolean(session.teamStepComplete),
    tourComplete: Boolean(onboarding?.tour_completed_at || onboarding?.tour_dismissed_at),
  };

  let sampleModeEnabled = false;
  if (session.workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: session.workspaceId },
      select: { sample_mode_enabled: true, name: true },
    });
    sampleModeEnabled = Boolean(workspace?.sample_mode_enabled);
  }

  return jsonWithRequestId(request, {
    session,
    user,
    provisionalCompanyName: user?.provisional_company_name ?? null,
    checklist,
    sampleModeEnabled,
  });
}
