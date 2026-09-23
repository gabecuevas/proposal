import { createHash, randomBytes } from "node:crypto";
import { prisma, type AuthTokenPurpose, type Prisma } from "@repo/db";

export const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function hashOpaqueToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

type Tx = Prisma.TransactionClient;

export async function issueAuthToken(params: {
  userId: string;
  purpose: AuthTokenPurpose;
  pendingEmail?: string | null;
  generation?: number;
  ttlMs: number;
  tx?: Tx;
}): Promise<{ rawToken: string; tokenId: string; expiresAt: Date }> {
  const client = params.tx ?? prisma;
  const rawToken = generateOpaqueToken();
  const tokenHash = hashOpaqueToken(rawToken);
  const expiresAt = new Date(Date.now() + params.ttlMs);

  await client.authToken.updateMany({
    where: {
      user_id: params.userId,
      purpose: params.purpose,
      consumed_at: null,
      revoked_at: null,
    },
    data: { revoked_at: new Date() },
  });

  const created = await client.authToken.create({
    data: {
      user_id: params.userId,
      purpose: params.purpose,
      token_hash: tokenHash,
      pending_email: params.pendingEmail ?? null,
      generation: params.generation ?? 0,
      expires_at: expiresAt,
    },
  });

  return { rawToken, tokenId: created.id, expiresAt };
}

export async function findValidAuthToken(params: {
  rawToken: string;
  purpose: AuthTokenPurpose;
}) {
  const tokenHash = hashOpaqueToken(params.rawToken);
  const token = await prisma.authToken.findUnique({
    where: { token_hash: tokenHash },
    include: { user: true },
  });
  if (!token || token.purpose !== params.purpose) {
    return null;
  }
  if (token.revoked_at || token.consumed_at) {
    return null;
  }
  if (token.expires_at.getTime() <= Date.now()) {
    return null;
  }
  return token;
}

export async function consumeAuthToken(params: {
  tokenId: string;
  userId: string;
  purpose: AuthTokenPurpose;
  generation?: number;
  tx?: Tx;
}): Promise<boolean> {
  const client = params.tx ?? prisma;
  const updated = await client.authToken.updateMany({
    where: {
      id: params.tokenId,
      user_id: params.userId,
      purpose: params.purpose,
      consumed_at: null,
      revoked_at: null,
      ...(typeof params.generation === "number" ? { generation: params.generation } : {}),
      expires_at: { gt: new Date() },
    },
    data: { consumed_at: new Date() },
  });
  return updated.count === 1;
}
