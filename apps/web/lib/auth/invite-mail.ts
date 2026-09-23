import { getCanonicalAppOrigin } from "./app-origin";
import { generateOpaqueToken, hashOpaqueToken } from "./auth-tokens";
import { enqueueMail, processPendingMail } from "@/lib/mail/outbox";
import { invitationEmail } from "@/lib/mail/templates";
import type { NextRequest } from "next/server";

export function createInviteTokenPair(): { rawToken: string; tokenHash: string } {
  const rawToken = generateOpaqueToken();
  return { rawToken, tokenHash: hashOpaqueToken(rawToken) };
}

export async function sendWorkspaceInviteEmail(params: {
  inviteId: string;
  toEmail: string;
  inviterName: string;
  companyName: string;
  rawToken: string;
  request?: NextRequest;
}) {
  const origin = getCanonicalAppOrigin(params.request);
  const inviteUrl = `${origin}/invite/${encodeURIComponent(params.rawToken)}`;
  const content = invitationEmail({
    inviterName: params.inviterName,
    companyName: params.companyName,
    inviteUrl,
  });
  await enqueueMail({
    toEmail: params.toEmail,
    subject: content.subject,
    htmlBody: content.html,
    textBody: content.text,
    purpose: "workspace_invite",
    idempotencyKey: `workspace_invite:${params.inviteId}:${Date.now()}`,
    supersedePurposeForEmail: false,
  });
  void processPendingMail().catch(() => undefined);
}
