import { createHash } from "node:crypto";
import { prisma } from "@repo/db";
import type { NextRequest } from "next/server";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import { postPublicMessage } from "@/lib/support/conversations";
import { isSupportEmailEnabled } from "@/lib/support/flags";
import { resolveConversationFromReplyAddress } from "@/lib/support/reply-token";
import {
  extractEmailAddress,
  verifyResendWebhookSignature,
} from "@/lib/support/webhook-verify";

type ResendWebhookBody = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    from?: string;
    to?: string | string[];
    subject?: string;
    message_id?: string;
  };
};

type ReceivedEmail = {
  id?: string;
  from?: string;
  to?: string[];
  subject?: string | null;
  text?: string | null;
  html?: string | null;
  message_id?: string | null;
  headers?: Record<string, string>;
};

async function fetchReceivedEmail(emailId: string): Promise<ReceivedEmail | null> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }
  const response = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as ReceivedEmail;
}

function looksLikeAutoresponder(headers: Record<string, string> | undefined, subject: string): boolean {
  if (!headers) {
    return false;
  }
  const autoSubmitted = (headers["auto-submitted"] ?? headers["Auto-Submitted"] ?? "").toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") {
    return true;
  }
  const precedence = (headers.precedence ?? headers.Precedence ?? "").toLowerCase();
  if (precedence === "bulk" || precedence === "list" || precedence === "junk") {
    return true;
  }
  const lowerSubject = subject.toLowerCase();
  return (
    lowerSubject.startsWith("out of office") ||
    lowerSubject.startsWith("automatic reply") ||
    lowerSubject.includes("delivery status notification")
  );
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function POST(request: NextRequest) {
  // Always accept durable receipt when email module is off, but do not mutate conversations.
  const acceptOnly = !isSupportEmailEnabled();

  const secret = process.env.RESEND_SUPPORT_WEBHOOK_SECRET?.trim();
  const raw = await request.text();

  if (!secret) {
    return errorResponse(request, {
      status: 503,
      code: "not_configured",
      message: "RESEND_SUPPORT_WEBHOOK_SECRET is not configured",
    });
  }

  const valid = verifyResendWebhookSignature({
    payload: raw,
    svixId: request.headers.get("svix-id"),
    svixTimestamp: request.headers.get("svix-timestamp"),
    svixSignature: request.headers.get("svix-signature"),
    secret,
  });
  if (!valid) {
    return errorResponse(request, {
      status: 401,
      code: "unauthorized",
      message: "Invalid webhook signature",
    });
  }

  let body: ResendWebhookBody;
  try {
    body = JSON.parse(raw) as ResendWebhookBody;
  } catch {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Invalid JSON",
    });
  }

  const providerEventId =
    request.headers.get("svix-id") ??
    body.data?.email_id ??
    createHash("sha256").update(raw).digest("hex");

  try {
    await prisma.inboundEmailEvent.create({
      data: {
        provider_event_id: providerEventId,
        provider_email_id: body.data?.email_id ?? null,
        raw_meta_json: body as object,
        status: acceptOnly ? "accepted_disabled" : "received",
      },
    });
  } catch {
    return jsonWithRequestId(request, { ok: true, duplicate: true });
  }

  if (acceptOnly) {
    return jsonWithRequestId(request, { ok: true, disabled: true });
  }

  if (body.type && body.type !== "email.received") {
    // Delivery state events can be handled later; keep chat isolated.
    await prisma.inboundEmailEvent.update({
      where: { provider_event_id: providerEventId },
      data: { status: "ignored", processed_at: new Date() },
    });
    return jsonWithRequestId(request, { ok: true, ignored: true });
  }

  const emailId = body.data?.email_id;
  if (!emailId) {
    await quarantine(providerEventId, "missing_email_id");
    return jsonWithRequestId(request, { ok: true, quarantined: true });
  }

  const received = await fetchReceivedEmail(emailId);
  if (!received) {
    await prisma.inboundEmailEvent.update({
      where: { provider_event_id: providerEventId },
      data: { status: "pending_fetch", last_error: "receiving_api_unavailable" },
    });
    return jsonWithRequestId(request, { ok: true, pending: true });
  }

  const toList = received.to?.length ? received.to : Array.isArray(body.data?.to) ? body.data.to : [body.data?.to].filter(Boolean);
  const toAddress = toList[0];
  const fromRaw = received.from ?? body.data?.from ?? "";
  const fromEmail = extractEmailAddress(fromRaw);
  const subject = received.subject ?? body.data?.subject ?? "";
  const text =
    received.text?.trim() ||
    (received.html ? stripHtml(received.html) : "") ||
    "(empty)";

  if (!toAddress) {
    await quarantine(providerEventId, "missing_to");
    return jsonWithRequestId(request, { ok: true, quarantined: true });
  }

  if (looksLikeAutoresponder(received.headers, subject)) {
    await quarantine(providerEventId, "autoresponder");
    return jsonWithRequestId(request, { ok: true, quarantined: true });
  }

  const resolved = await resolveConversationFromReplyAddress(toAddress);
  if (!resolved) {
    await quarantine(providerEventId, "reply_token_mismatch");
    return jsonWithRequestId(request, { ok: true, quarantined: true });
  }

  const participant = await prisma.user.findUnique({
    where: { id: resolved.recipientUserId },
    select: { email: true, email_verified_at: true },
  });
  if (!participant?.email_verified_at || participant.email.toLowerCase() !== fromEmail) {
    await quarantine(providerEventId, "sender_mismatch");
    return jsonWithRequestId(request, { ok: true, quarantined: true });
  }

  try {
    await postPublicMessage({
      conversationId: resolved.conversationId,
      senderUserId: resolved.recipientUserId,
      bodyText: text,
      clientOpId: `email:${emailId}`,
      fromAdmin: false,
      source: "EMAIL",
      emailMessageId: received.message_id ?? body.data?.message_id ?? null,
      providerEmailId: emailId,
    });
    await prisma.inboundEmailEvent.update({
      where: { provider_event_id: providerEventId },
      data: { status: "processed", processed_at: new Date() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "process_failed";
    await prisma.inboundEmailEvent.update({
      where: { provider_event_id: providerEventId },
      data: { status: "failed", last_error: message },
    });
  }

  return jsonWithRequestId(request, { ok: true });
}

async function quarantine(providerEventId: string, reason: string) {
  await prisma.inboundEmailEvent.update({
    where: { provider_event_id: providerEventId },
    data: { status: "quarantined", last_error: reason, processed_at: new Date() },
  });
}
