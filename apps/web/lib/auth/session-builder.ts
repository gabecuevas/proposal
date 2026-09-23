import { prisma, type User, type Workspace, type WorkspaceMember } from "@repo/db";
import type { SessionPayload } from "./session";

export async function buildSessionPayload(userId: string): Promise<SessionPayload | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return null;
  }
  return buildSessionPayloadFromUser(user);
}

export async function buildSessionPayloadFromUser(
  user: User,
  preferredWorkspaceId?: string | null,
): Promise<SessionPayload> {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      user_id: user.id,
      ...(preferredWorkspaceId ? { workspace_id: preferredWorkspaceId } : {}),
    },
    orderBy: { created_at: "asc" },
    include: { workspace: true },
  });

  if (!membership) {
    return {
      userId: user.id,
      workspaceId: null,
      role: null,
      email: user.email,
      emailVerified: Boolean(user.email_verified_at),
      companySetupComplete: false,
      teamStepComplete: false,
    };
  }

  const onboarding = await prisma.userWorkspaceOnboarding.findUnique({
    where: {
      user_id_workspace_id: {
        user_id: user.id,
        workspace_id: membership.workspace_id,
      },
    },
  });

  const companySetupComplete = Boolean(membership.workspace.company_setup_completed_at);
  // Legacy members (workspace existed before onboarding rows) skip the team step.
  const teamStepComplete = onboarding
    ? Boolean(onboarding.team_step_completed_at || onboarding.team_step_skipped_at)
    : companySetupComplete;

  return {
    userId: user.id,
    workspaceId: user.default_workspace_id ?? membership.workspace_id,
    role: membership.role,
    email: user.email,
    emailVerified: Boolean(user.email_verified_at),
    companySetupComplete,
    teamStepComplete,
  };
}

export function postAuthRedirectPath(session: SessionPayload, preferredNext?: string | null): string {
  if (!session.emailVerified) {
    return "/verify-email";
  }
  if (!session.workspaceId || !session.companySetupComplete) {
    return "/onboarding/company";
  }
  if (!session.teamStepComplete) {
    return "/onboarding/team";
  }
  if (preferredNext && preferredNext.startsWith("/") && !preferredNext.startsWith("//")) {
    if (
      preferredNext.startsWith("/verify-email") ||
      preferredNext.startsWith("/onboarding/") ||
      preferredNext.startsWith("/signup") ||
      preferredNext.startsWith("/login")
    ) {
      return "/app";
    }
    return preferredNext;
  }
  return "/app";
}

export type MembershipWithWorkspace = WorkspaceMember & { workspace: Workspace };
