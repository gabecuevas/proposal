import { createHash } from "node:crypto";
import { SignJWT } from "jose";
import { stableStringify } from "./checksum";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? "dev-only-secret-change-me";
  return new TextEncoder().encode(secret);
}

export function computeManifestHash(manifest: Record<string, unknown>): string {
  return createHash("sha256").update(stableStringify(manifest)).digest("hex");
}

export async function signEvidenceManifest(input: {
  workspaceId: string;
  actorUserId: string;
  manifestHash: string;
  ledgerEntryHash: string;
  expiresInSeconds: number;
}) {
  return new SignJWT({
    purpose: "audit-evidence",
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    manifestHash: input.manifestHash,
    ledgerEntryHash: input.ledgerEntryHash,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${Math.max(1, Math.trunc(input.expiresInSeconds))}s`)
    .sign(getSecret());
}
