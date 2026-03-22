import { createHash, randomBytes } from "node:crypto";

const API_KEY_PREFIX = "pk_live_";
const DEFAULT_API_KEY_TTL_DAYS = Number(process.env.API_KEY_DEFAULT_TTL_DAYS ?? 90);

export function hashApiKey(rawKey: string): string {
  return createHash("sha256").update(rawKey).digest("hex");
}

export function generateApiKeyMaterial(): {
  rawKey: string;
  keyPrefix: string;
  keyHash: string;
} {
  const token = randomBytes(24).toString("hex");
  const rawKey = `${API_KEY_PREFIX}${token}`;
  const keyPrefix = rawKey.slice(0, 12);
  return {
    rawKey,
    keyPrefix,
    keyHash: hashApiKey(rawKey),
  };
}

export function getApiKeyFromRequestAuthHeader(authHeader: string | null): string | null {
  if (!authHeader) {
    return null;
  }
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.slice("Bearer ".length).trim();
  if (!token.startsWith(API_KEY_PREFIX)) {
    return null;
  }
  return token;
}

export function getApiKeyExpiryDate(expiresInDays?: number): Date {
  const days = Number.isFinite(expiresInDays) && expiresInDays && expiresInDays > 0
    ? Math.min(3650, Math.trunc(expiresInDays))
    : Math.min(3650, Math.max(1, Math.trunc(DEFAULT_API_KEY_TTL_DAYS)));
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

export function isApiKeyExpired(expiresAt: Date | null): boolean {
  if (!expiresAt) {
    return false;
  }
  return expiresAt.getTime() <= Date.now();
}
