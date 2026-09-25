import { prisma, type Prisma } from "@repo/db";
import { buildSessionPayload } from "@/lib/auth/session-builder";
import { SUDO_SESSION_MAX_AGE, type SessionPayload } from "@/lib/auth/session";

export type BulkAccountAction =
  | "disable"
  | "enable"
  | "archive"
  | "unarchive"
  | "freeze"
  | "unfreeze"
  | "delete";

export const BULK_ACCOUNT_ACTIONS: BulkAccountAction[] = [
  "disable",
  "enable",
  "archive",
  "unarchive",
  "freeze",
  "unfreeze",
  "delete",
];

export type BulkActionResult = {
  userId: string;
  email: string | null;
  ok: boolean;
  message?: string;
};

export class AccountAdminError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "validation_error",
  ) {
    super(message);
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type TargetUser = { id: string; email: string; is_platform_admin: boolean };

async function loadTargets(userIds: string[]): Promise<Map<string, TargetUser>> {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, email: true, is_platform_admin: true },
  });
  return new Map(users.map((u) => [u.id, u]));
}

function protectedTargetReason(
  target: TargetUser,
  adminUserId: string,
  action: BulkAccountAction,
): string | null {
  const restoring = action === "enable" || action === "unarchive" || action === "unfreeze";
  if (restoring) {
    return null;
  }
  if (target.id === adminUserId) {
    return "You cannot apply this action to your own account";
  }
  if (target.is_platform_admin) {
    return "Platform admin accounts are protected";
  }
  return null;
}

async function audit(
  tx: Prisma.TransactionClient | typeof prisma,
  adminUserId: string,
  action: string,
  targetId: string,
  metadata: Record<string, unknown>,
) {
  await tx.supportAuditEvent.create({
    data: {
      actor_user_id: adminUserId,
      action,
      target_type: "User",
      target_id: targetId,
      metadata_json: metadata as Prisma.InputJsonValue,
    },
  });
}

/** Ensure the workspace still has an owner after `leavingUserId` is removed or demoted. */
async function reassignOwnershipIfNeeded(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  leavingUserId: string,
): Promise<string | null> {
  const others = await tx.workspaceMember.findMany({
    where: { workspace_id: workspaceId, user_id: { not: leavingUserId } },
    orderBy: { created_at: "asc" },
    select: { user_id: true, role: true },
  });
  if (others.length === 0) {
    return null;
  }
  const rank = { OWNER: 0, ADMIN: 1, MEMBER: 2 } as const;
  const successor = [...others].sort((a, b) => rank[a.role] - rank[b.role])[0]!;
  if (successor.role !== "OWNER") {
    await tx.workspaceMember.update({
      where: {
        workspace_id_user_id: { workspace_id: workspaceId, user_id: successor.user_id },
      },
      data: { role: "OWNER" },
    });
  }
  await tx.workspace.update({
    where: { id: workspaceId },
    data: { owner_user_id: successor.user_id },
  });
  return successor.user_id;
}

async function deleteAccount(
  targetId: string,
  adminUserId: string,
  purgeWorkspaces: boolean,
): Promise<{ purgedWorkspaceIds: string[]; transferredWorkspaceIds: string[] }> {
  return prisma.$transaction(
    async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: targetId },
        select: { id: true, email: true, name: true },
      });
      const memberships = await tx.workspaceMember.findMany({
        where: { user_id: targetId },
        select: {
          role: true,
          workspace: {
            select: { id: true, name: true, owner_user_id: true, _count: { select: { members: true } } },
          },
        },
      });

      const purgedWorkspaceIds: string[] = [];
      const transferredWorkspaceIds: string[] = [];
      for (const membership of memberships) {
        const workspace = membership.workspace;
        if (workspace._count.members <= 1) {
          if (purgeWorkspaces) {
            await tx.workspace.delete({ where: { id: workspace.id } });
            purgedWorkspaceIds.push(workspace.id);
          }
          continue;
        }
        if (membership.role === "OWNER" || workspace.owner_user_id === targetId) {
          const remainingOwner = await tx.workspaceMember.findFirst({
            where: { workspace_id: workspace.id, role: "OWNER", user_id: { not: targetId } },
            select: { user_id: true },
          });
          if (remainingOwner) {
            if (workspace.owner_user_id === targetId) {
              await tx.workspace.update({
                where: { id: workspace.id },
                data: { owner_user_id: remainingOwner.user_id },
              });
            }
          } else {
            await reassignOwnershipIfNeeded(tx, workspace.id, targetId);
          }
          transferredWorkspaceIds.push(workspace.id);
        }
      }

      await audit(tx, adminUserId, purgeWorkspaces ? "account.purge" : "account.delete", targetId, {
        email: user.email,
        name: user.name,
        purgedWorkspaceIds,
        transferredWorkspaceIds,
      });
      await tx.user.delete({ where: { id: targetId } });
      return { purgedWorkspaceIds, transferredWorkspaceIds };
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

async function setBillingFrozen(targetId: string, adminUserId: string, frozen: boolean) {
  const owned = await prisma.workspaceMember.findMany({
    where: { user_id: targetId, role: "OWNER" },
    select: { workspace_id: true },
  });
  if (owned.length === 0) {
    throw new AccountAdminError("User does not own a workspace to bill");
  }
  const workspaceIds = owned.map((m) => m.workspace_id);
  await prisma.$transaction(async (tx) => {
    await tx.workspace.updateMany({
      where: { id: { in: workspaceIds } },
      data: { billing_frozen_at: frozen ? new Date() : null },
    });
    await audit(tx, adminUserId, frozen ? "billing.freeze" : "billing.unfreeze", targetId, {
      workspaceIds,
    });
  });
  return workspaceIds.length;
}

export async function runBulkAccountAction(input: {
  action: BulkAccountAction;
  userIds: string[];
  adminUserId: string;
  reason?: string | null;
  purgeWorkspaces?: boolean;
}): Promise<BulkActionResult[]> {
  const userIds = [...new Set(input.userIds)].slice(0, 100);
  const targets = await loadTargets(userIds);
  const results: BulkActionResult[] = [];

  for (const userId of userIds) {
    const target = targets.get(userId);
    if (!target) {
      results.push({ userId, email: null, ok: false, message: "User not found" });
      continue;
    }
    const blocked = protectedTargetReason(target, input.adminUserId, input.action);
    if (blocked) {
      results.push({ userId, email: target.email, ok: false, message: blocked });
      continue;
    }

    try {
      switch (input.action) {
        case "disable":
          await prisma.$transaction([
            prisma.user.update({
              where: { id: userId },
              data: { disabled_at: new Date(), disabled_reason: input.reason?.trim() || null },
            }),
            prisma.supportImpersonationSession.updateMany({
              where: { target_user_id: userId, ended_at: null },
              data: { ended_at: new Date(), ended_reason: "target_disabled" },
            }),
          ]);
          await audit(prisma, input.adminUserId, "account.disable", userId, {
            reason: input.reason ?? null,
          });
          break;
        case "enable":
          await prisma.user.update({
            where: { id: userId },
            data: { disabled_at: null, disabled_reason: null },
          });
          await audit(prisma, input.adminUserId, "account.enable", userId, {});
          break;
        case "archive":
          await prisma.user.update({ where: { id: userId }, data: { archived_at: new Date() } });
          await audit(prisma, input.adminUserId, "account.archive", userId, {});
          break;
        case "unarchive":
          await prisma.user.update({ where: { id: userId }, data: { archived_at: null } });
          await audit(prisma, input.adminUserId, "account.unarchive", userId, {});
          break;
        case "freeze":
        case "unfreeze": {
          const count = await setBillingFrozen(userId, input.adminUserId, input.action === "freeze");
          results.push({
            userId,
            email: target.email,
            ok: true,
            message: `${count} workspace${count === 1 ? "" : "s"} updated`,
          });
          continue;
        }
        case "delete": {
          const outcome = await deleteAccount(userId, input.adminUserId, input.purgeWorkspaces ?? false);
          const parts = [
            outcome.purgedWorkspaceIds.length
              ? `${outcome.purgedWorkspaceIds.length} workspace(s) purged`
              : null,
            outcome.transferredWorkspaceIds.length
              ? `ownership transferred in ${outcome.transferredWorkspaceIds.length} workspace(s)`
              : null,
          ].filter(Boolean);
          results.push({
            userId,
            email: target.email,
            ok: true,
            message: parts.join("; ") || undefined,
          });
          continue;
        }
      }
      results.push({ userId, email: target.email, ok: true });
    } catch (error) {
      const message =
        error instanceof AccountAdminError ? error.message : "Action failed; nothing was changed";
      if (!(error instanceof AccountAdminError)) {
        console.error(`[admin/account-action] ${input.action} failed for ${userId}`, error);
      }
      results.push({ userId, email: target.email, ok: false, message });
    }
  }

  return results;
}

export type EditAccountInput = {
  name?: string;
  email?: string;
  workspaceId?: string;
  company?: string;
  type?: "OWNER" | "USER";
};

export async function editAccount(
  targetId: string,
  adminUserId: string,
  input: EditAccountInput,
): Promise<{ googleUnlinked: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: targetId },
    select: { id: true, email: true, name: true, google_sub: true, is_platform_admin: true },
  });
  if (!user) {
    throw new AccountAdminError("User not found", 404, "not_found");
  }

  const userData: Prisma.UserUpdateInput = {};
  const changes: Record<string, Record<string, unknown>> = {};

  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name || name.length > 120) {
      throw new AccountAdminError("Name must be 1–120 characters");
    }
    if (name !== user.name) {
      userData.name = name;
      changes.name = { from: user.name, to: name };
    }
  }

  let googleUnlinked = false;
  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      throw new AccountAdminError("Enter a valid email address");
    }
    if (email !== user.email) {
      if (user.is_platform_admin) {
        throw new AccountAdminError(
          "Platform admin emails are managed by PLATFORM_ADMIN_EMAILS and cannot be changed here",
          403,
          "forbidden",
        );
      }
      const taken = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (taken) {
        throw new AccountAdminError("Another account already uses that email", 409, "email_taken");
      }
      userData.email = email;
      userData.pending_email = null;
      // Google sign-in matches by email; a stale link would collide with the new address.
      if (user.google_sub) {
        userData.google_sub = null;
        googleUnlinked = true;
      }
      changes.email = { from: user.email, to: email };
    }
  }

  const needsWorkspace = input.company !== undefined || input.type !== undefined;
  let membership: { role: "OWNER" | "ADMIN" | "MEMBER"; workspace: { id: string; name: string; owner_user_id: string | null } } | null = null;
  if (needsWorkspace) {
    if (!input.workspaceId) {
      throw new AccountAdminError("Choose which workspace to edit");
    }
    membership = await prisma.workspaceMember.findUnique({
      where: { workspace_id_user_id: { workspace_id: input.workspaceId, user_id: targetId } },
      select: { role: true, workspace: { select: { id: true, name: true, owner_user_id: true } } },
    });
    if (!membership) {
      throw new AccountAdminError("User is not a member of that workspace");
    }
  }

  const company = input.company?.trim();
  if (input.company !== undefined && (!company || company.length > 120)) {
    throw new AccountAdminError("Company must be 1–120 characters");
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length > 0) {
      await tx.user.update({ where: { id: targetId }, data: userData });
    }
    if (membership && company && company !== membership.workspace.name) {
      await tx.workspace.update({ where: { id: membership.workspace.id }, data: { name: company } });
      changes.company = { from: membership.workspace.name, to: company };
    }
    if (membership && input.type) {
      const workspaceId = membership.workspace.id;
      if (input.type === "OWNER" && membership.role !== "OWNER") {
        await tx.workspaceMember.updateMany({
          where: { workspace_id: workspaceId, role: "OWNER", user_id: { not: targetId } },
          data: { role: "ADMIN" },
        });
        await tx.workspaceMember.update({
          where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: targetId } },
          data: { role: "OWNER" },
        });
        await tx.workspace.update({ where: { id: workspaceId }, data: { owner_user_id: targetId } });
        changes.type = { from: membership.role, to: "OWNER" };
      } else if (input.type === "USER" && membership.role === "OWNER") {
        const successor = await reassignOwnershipIfNeeded(tx, workspaceId, targetId);
        if (!successor) {
          throw new AccountAdminError(
            "This user is the only member. Invite or promote someone else to Account Owner first.",
          );
        }
        await tx.workspaceMember.update({
          where: { workspace_id_user_id: { workspace_id: workspaceId, user_id: targetId } },
          data: { role: "ADMIN" },
        });
        changes.type = { from: "OWNER", to: "ADMIN", newOwnerUserId: successor };
      }
    }
    if (Object.keys(changes).length > 0) {
      await audit(tx, adminUserId, "account.edit", targetId, {
        workspaceId: input.workspaceId ?? null,
        changes,
        googleUnlinked,
      });
    }
  });

  return { googleUnlinked };
}

export async function startSudoSession(input: {
  adminUserId: string;
  adminEmail: string;
  targetUserId: string;
}): Promise<SessionPayload> {
  if (input.targetUserId === input.adminUserId) {
    throw new AccountAdminError("You are already signed in as yourself");
  }
  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, email: true, is_platform_admin: true, disabled_at: true },
  });
  if (!target) {
    throw new AccountAdminError("User not found", 404, "not_found");
  }
  if (target.is_platform_admin) {
    throw new AccountAdminError("Sudo into another platform admin is not allowed", 403, "forbidden");
  }
  if (target.disabled_at) {
    throw new AccountAdminError("Enable this account before using sudo");
  }

  const base = await buildSessionPayload(target.id);
  if (!base) {
    throw new AccountAdminError("User not found", 404, "not_found");
  }

  const record = await prisma.$transaction(async (tx) => {
    await tx.supportImpersonationSession.updateMany({
      where: { admin_user_id: input.adminUserId, ended_at: null },
      data: { ended_at: new Date(), ended_reason: "superseded" },
    });
    const created = await tx.supportImpersonationSession.create({
      data: {
        admin_user_id: input.adminUserId,
        admin_email: input.adminEmail,
        target_user_id: target.id,
        target_email: target.email,
        expires_at: new Date(Date.now() + SUDO_SESSION_MAX_AGE * 1000),
      },
    });
    await audit(tx, input.adminUserId, "sudo.start", target.id, {
      impersonationId: created.id,
      targetEmail: target.email,
    });
    return created;
  });

  return {
    ...base,
    impersonatorUserId: input.adminUserId,
    impersonationId: record.id,
  };
}

export async function endSudoSession(impersonationId: string, reason: string): Promise<void> {
  const record = await prisma.supportImpersonationSession.findUnique({
    where: { id: impersonationId },
  });
  if (!record || record.ended_at) {
    return;
  }
  await prisma.$transaction([
    prisma.supportImpersonationSession.update({
      where: { id: impersonationId },
      data: { ended_at: new Date(), ended_reason: reason },
    }),
    prisma.supportAuditEvent.create({
      data: {
        actor_user_id: record.admin_user_id,
        action: "sudo.end",
        target_type: "User",
        target_id: record.target_user_id,
        metadata_json: { impersonationId, reason, requestCount: record.request_count },
      },
    }),
  ]);
}
