import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { getApiKeyFromRequestAuthHeader, hashApiKey, isApiKeyExpired } from "./api-keys";
import { isSudoSessionLive, recordSudoRequest } from "./account-status";
import { hasRole, type WorkspaceRole } from "./rbac";
import { requireSessionFromRequest } from "./session";

export type RequestAuthContext = {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  email: string;
  authType: "session" | "api-key";
  apiKeyId?: string;
  /** Present when a platform admin is acting as this user (sudo). */
  impersonatorUserId?: string;
};

export async function getRequestAuthContext(request: NextRequest): Promise<RequestAuthContext> {
  const apiKey = getApiKeyFromRequestAuthHeader(request.headers.get("authorization"));
  if (apiKey) {
    const keyHash = hashApiKey(apiKey);
    const key = await prisma.apiKey.findFirst({
      where: {
        key_hash: keyHash,
        revoked_at: null,
      },
    });
    if (!key) {
      throw new Error("Unauthorized");
    }
    if (isApiKeyExpired(key.expires_at)) {
      throw new Error("Unauthorized");
    }
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { last_used_at: new Date() },
    });
    return {
      userId: key.created_by,
      workspaceId: key.workspace_id,
      role: key.role as WorkspaceRole,
      email: "api-key@system.local",
      authType: "api-key",
      apiKeyId: key.id,
    };
  }

  const session = await requireSessionFromRequest(request);
  if (!session) {
    throw new Error("Unauthorized");
  }

  if (!session.workspaceId) {
    throw new Error("Forbidden");
  }

  const member = await prisma.workspaceMember.findFirst({
    where: {
      workspace_id: session.workspaceId,
      user_id: session.userId,
    },
    include: { user: { select: { disabled_at: true } } },
  });
  if (!member) {
    throw new Error("Forbidden");
  }
  if (member.user.disabled_at) {
    throw new Error("Unauthorized");
  }
  if (session.impersonationId) {
    if (!(await isSudoSessionLive(session))) {
      throw new Error("Unauthorized");
    }
    await recordSudoRequest(session, request);
  }

  return {
    userId: session.userId,
    workspaceId: session.workspaceId,
    role: member.role as WorkspaceRole,
    email: session.email,
    authType: "session",
    impersonatorUserId: session.impersonatorUserId,
  };
}

export function assertRole(context: RequestAuthContext, requiredRole: WorkspaceRole) {
  if (!hasRole(requiredRole, context.role)) {
    throw new Error("Forbidden");
  }
}
