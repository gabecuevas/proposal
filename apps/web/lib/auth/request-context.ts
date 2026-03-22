import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { getApiKeyFromRequestAuthHeader, hashApiKey, isApiKeyExpired } from "./api-keys";
import { hasRole, type WorkspaceRole } from "./rbac";
import { requireSessionFromRequest } from "./session";

export type RequestAuthContext = {
  userId: string;
  workspaceId: string;
  role: WorkspaceRole;
  email: string;
  authType: "session" | "api-key";
  apiKeyId?: string;
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

  const member = await prisma.workspaceMember.findFirst({
    where: {
      workspace_id: session.workspaceId,
      user_id: session.userId,
    },
  });
  if (!member) {
    throw new Error("Forbidden");
  }

  return {
    userId: session.userId,
    workspaceId: session.workspaceId,
    role: member.role as WorkspaceRole,
    email: session.email,
    authType: "session",
  };
}

export function assertRole(context: RequestAuthContext, requiredRole: WorkspaceRole) {
  if (!hasRole(requiredRole, context.role)) {
    throw new Error("Forbidden");
  }
}
