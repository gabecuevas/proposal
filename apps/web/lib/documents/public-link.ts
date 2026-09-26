import { createHmac, timingSafeEqual } from "node:crypto";

const PURPOSE = "public-document-view";
const SIGNATURE_LENGTH = 32;

function getSecret(): string {
  return process.env.AUTH_SECRET ?? "dev-only-secret-change-me";
}

function sign(documentId: string): string {
  return createHmac("sha256", getSecret())
    .update(`${PURPOSE}:${documentId}`)
    .digest("base64url")
    .slice(0, SIGNATURE_LENGTH);
}

/** Stable, unguessable view-only token for a document (`<id>.<signature>`). */
export function publicDocumentToken(documentId: string): string {
  return `${documentId}.${sign(documentId)}`;
}

export function verifyPublicDocumentToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) {
    return null;
  }
  const documentId = token.slice(0, dot);
  const provided = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(sign(documentId));
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }
  return documentId;
}

export function publicDocumentUrl(documentId: string, origin: string): string {
  return `${origin.replace(/\/$/, "")}/d/${publicDocumentToken(documentId)}`;
}
