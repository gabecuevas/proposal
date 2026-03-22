import { SignJWT, jwtVerify } from "jose";

const DOWNLOAD_TTL_SECONDS = 60 * 15;

export type ArtifactDownloadTokenPayload = {
  documentId: string;
  workspaceId: string;
  pdfKey: string;
  purpose: "artifact-download";
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET ?? "dev-only-secret-change-me";
  return new TextEncoder().encode(secret);
}

export async function signArtifactDownloadToken(
  payload: Omit<ArtifactDownloadTokenPayload, "purpose">,
): Promise<string> {
  return new SignJWT({
    ...payload,
    purpose: "artifact-download",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DOWNLOAD_TTL_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyArtifactDownloadToken(
  token: string,
): Promise<ArtifactDownloadTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const typed = payload as ArtifactDownloadTokenPayload;
    if (typed.purpose !== "artifact-download") {
      return null;
    }
    return typed;
  } catch {
    return null;
  }
}
