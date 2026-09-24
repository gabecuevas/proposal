import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@repo/db";
import { supportReplyDomain } from "@/lib/support/flags";

export function hashReplyToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function extractOpaqueToken(localPart: string): string | null {
  const trimmed = localPart.trim();
  if (!trimmed) {
    return null;
  }
  // Prefer reply+<token>@domain; also accept bare <token>@domain for older tokens.
  if (trimmed.toLowerCase().startsWith("reply+")) {
    return trimmed.slice("reply+".length) || null;
  }
  return trimmed;
}

/** Ensures an active opaque reply address for outbound support email. */
export async function ensureReplyTokenForEmail(input: {
  conversationId: string;
  recipientUserId: string;
}): Promise<string> {
  const rawToken = randomBytes(24).toString("base64url");
  const tokenHash = hashReplyToken(rawToken);

  await prisma.supportReplyToken.updateMany({
    where: {
      conversation_id: input.conversationId,
      recipient_user_id: input.recipientUserId,
      revoked_at: null,
    },
    data: { revoked_at: new Date() },
  });

  await prisma.supportReplyToken.create({
    data: {
      conversation_id: input.conversationId,
      recipient_user_id: input.recipientUserId,
      token_hash: tokenHash,
    },
  });

  return `reply+${rawToken}@${supportReplyDomain()}`;
}

export async function resolveConversationFromReplyAddress(
  address: string,
): Promise<{ conversationId: string; recipientUserId: string } | null> {
  const local = address.split("@")[0];
  const token = extractOpaqueToken(local ?? "");
  if (!token) {
    return null;
  }
  const tokenHash = hashReplyToken(token);
  const row = await prisma.supportReplyToken.findUnique({
    where: { token_hash: tokenHash },
    select: { conversation_id: true, recipient_user_id: true, revoked_at: true },
  });
  if (!row || row.revoked_at) {
    return null;
  }
  return {
    conversationId: row.conversation_id,
    recipientUserId: row.recipient_user_id,
  };
}
