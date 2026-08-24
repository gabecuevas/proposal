import { SignJWT, jwtVerify } from "jose";

/**
 * Longer-lived than artifact downloads: the PDF worker resolves these while
 * rendering a queued job, which can start well after the job was enqueued.
 */
const ASSET_TOKEN_TTL_SECONDS = 60 * 60 * 24;

export type AssetTokenPayload = {
  workspaceId: string;
  purpose: "asset-read";
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? "dev-only-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function signAssetToken(workspaceId: string): Promise<string> {
  return new SignJWT({ workspaceId, purpose: "asset-read" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${ASSET_TOKEN_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyAssetToken(token: string): Promise<AssetTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const typed = payload as AssetTokenPayload;
    if (typed.purpose !== "asset-read" || !typed.workspaceId) {
      return null;
    }
    return typed;
  } catch {
    return null;
  }
}
