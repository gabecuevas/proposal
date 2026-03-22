import { prisma } from "@repo/db";
import { hashPassword } from "./password";
import type { SessionPayload } from "./session";

export async function resolveOAuthSession(input: {
  email: string;
  name: string;
}): Promise<SessionPayload> {
  const normalizedEmail = input.email.trim().toLowerCase();
  const normalizedName = input.name.trim() || "Google User";

  const existingUser = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!existingUser) {
    const passwordHash = await hashPassword(crypto.randomUUID());
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: normalizedName,
          password_hash: passwordHash,
        },
      });
      const workspace = await tx.workspace.create({
        data: {
          name: `${normalizedName} Workspace`,
          owner_user_id: user.id,
        },
      });
      await tx.workspaceMember.create({
        data: {
          workspace_id: workspace.id,
          user_id: user.id,
          role: "OWNER",
        },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { default_workspace_id: workspace.id },
      });
      return {
        userId: user.id,
        workspaceId: workspace.id,
        role: "OWNER" as const,
      };
    });
    return {
      userId: created.userId,
      workspaceId: created.workspaceId,
      role: created.role,
      email: normalizedEmail,
    };
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { user_id: existingUser.id },
    orderBy: { created_at: "asc" },
  });
  if (!membership) {
    const created = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: `${existingUser.name} Workspace`,
          owner_user_id: existingUser.id,
        },
      });
      await tx.workspaceMember.create({
        data: {
          workspace_id: workspace.id,
          user_id: existingUser.id,
          role: "OWNER",
        },
      });
      await tx.user.update({
        where: { id: existingUser.id },
        data: { default_workspace_id: workspace.id },
      });
      return workspace.id;
    });
    return {
      userId: existingUser.id,
      workspaceId: created,
      role: "OWNER",
      email: existingUser.email,
    };
  }

  return {
    userId: existingUser.id,
    workspaceId: existingUser.default_workspace_id ?? membership.workspace_id,
    role: membership.role,
    email: existingUser.email,
  };
}
