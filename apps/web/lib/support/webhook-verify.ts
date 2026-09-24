import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify Resend/Svix webhook signatures without adding a new dependency.
 * @see https://resend.com/docs/webhooks/verify-webhooks-requests
 */
export function verifyResendWebhookSignature(input: {
  payload: string;
  svixId: string | null;
  svixTimestamp: string | null;
  svixSignature: string | null;
  secret: string;
  /** Reject timestamps older than this many seconds (default 5 minutes). */
  toleranceSeconds?: number;
}): boolean {
  const { payload, svixId, svixTimestamp, svixSignature, secret } = input;
  if (!svixId || !svixTimestamp || !svixSignature || !secret) {
    return false;
  }

  const ts = Number(svixTimestamp);
  if (!Number.isFinite(ts)) {
    return false;
  }
  const tolerance = input.toleranceSeconds ?? 300;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > tolerance) {
    return false;
  }

  const key = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret);

  const signedContent = `${svixId}.${svixTimestamp}.${payload}`;
  const expected = createHmac("sha256", key).update(signedContent).digest("base64");

  const candidates = svixSignature.split(" ").flatMap((part) => {
    const [version, sig] = part.split(",");
    return version === "v1" && sig ? [sig] : [];
  });

  const expectedBuf = Buffer.from(expected);
  for (const candidate of candidates) {
    const candidateBuf = Buffer.from(candidate);
    if (
      expectedBuf.length === candidateBuf.length &&
      timingSafeEqual(expectedBuf, candidateBuf)
    ) {
      return true;
    }
  }
  return false;
}

export function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  const raw = (match?.[1] ?? fromHeader).trim().toLowerCase();
  return raw;
}
