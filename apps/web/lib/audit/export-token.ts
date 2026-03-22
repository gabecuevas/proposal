import { SignJWT, jwtVerify } from "jose";

export type AuditExportType = "activity" | "webhook-deliveries";

export type AuditExportTokenClaims = {
  purpose: "audit-export";
  workspaceId: string;
  actorUserId: string;
  exportType: AuditExportType;
  before?: string;
  limit: number;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? "dev-only-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function signAuditExportToken(input: {
  workspaceId: string;
  actorUserId: string;
  exportType: AuditExportType;
  before?: string;
  limit: number;
  expiresInSeconds: number;
}) {
  const claims: AuditExportTokenClaims = {
    purpose: "audit-export",
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    exportType: input.exportType,
    before: input.before,
    limit: input.limit,
  };
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${Math.max(1, Math.trunc(input.expiresInSeconds))}s`)
    .sign(getSecret());
}

export async function verifyAuditExportToken(token: string): Promise<AuditExportTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.purpose !== "audit-export") {
      return null;
    }
    if (
      typeof payload.workspaceId !== "string" ||
      typeof payload.actorUserId !== "string" ||
      (payload.exportType !== "activity" && payload.exportType !== "webhook-deliveries") ||
      typeof payload.limit !== "number"
    ) {
      return null;
    }
    return {
      purpose: "audit-export",
      workspaceId: payload.workspaceId,
      actorUserId: payload.actorUserId,
      exportType: payload.exportType,
      before: typeof payload.before === "string" ? payload.before : undefined,
      limit: payload.limit,
    };
  } catch {
    return null;
  }
}
