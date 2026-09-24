import { prisma } from "@repo/db";
import { enqueueMail } from "@/lib/mail/outbox";
import { supportUnreadNotificationEmail } from "@/lib/support/email-templates";
import { ensureReplyTokenForEmail } from "@/lib/support/reply-token";

const LEASE_MS = 60_000;

type NotifyUnreadPayload = {
  conversationId: string;
  messageId: string;
  customerUserId: string;
  messageSequence: number;
};

export async function claimSupportJobs(limit = 10) {
  const now = new Date();
  const jobs = await prisma.supportJob.findMany({
    where: {
      status: "pending",
      run_after: { lte: now },
      OR: [{ lease_expires_at: null }, { lease_expires_at: { lt: now } }],
    },
    orderBy: { run_after: "asc" },
    take: limit,
  });

  const claimed = [];
  for (const job of jobs) {
    const updated = await prisma.supportJob.updateMany({
      where: {
        id: job.id,
        status: "pending",
        OR: [{ lease_expires_at: null }, { lease_expires_at: { lt: now } }],
      },
      data: {
        status: "processing",
        lease_expires_at: new Date(Date.now() + LEASE_MS),
        attempts: { increment: 1 },
      },
    });
    if (updated.count === 1) {
      claimed.push(job);
    }
  }
  return claimed;
}

async function processNotifyUnread(payload: NotifyUnreadPayload): Promise<void> {
  const { isSupportEmailEnabled } = await import("@/lib/support/flags");
  if (!isSupportEmailEnabled()) {
    return;
  }

  const readState = await prisma.supportReadState.findUnique({
    where: {
      conversation_id_user_id: {
        conversation_id: payload.conversationId,
        user_id: payload.customerUserId,
      },
    },
  });
  if (readState && readState.last_read_sequence >= payload.messageSequence) {
    await prisma.supportEmailDelivery.create({
      data: {
        conversation_id: payload.conversationId,
        message_id: payload.messageId,
        to_email: "(suppressed)",
        status: "suppressed_read",
      },
    });
    return;
  }

  const conversation = await prisma.supportConversation.findUnique({
    where: { id: payload.conversationId },
    include: {
      customer: { select: { email: true, name: true, email_verified_at: true } },
    },
  });
  if (!conversation?.customer) {
    return;
  }

  if (!conversation.customer.email_verified_at) {
    await prisma.supportEmailDelivery.create({
      data: {
        conversation_id: payload.conversationId,
        message_id: payload.messageId,
        to_email: conversation.customer.email,
        status: "suppressed_unverified",
        last_error: "Recipient email is not verified",
      },
    });
    return;
  }

  const message = await prisma.supportMessage.findUnique({
    where: { id: payload.messageId },
  });
  if (!message || message.visibility !== "PUBLIC") {
    return;
  }

  const recent = await prisma.supportEmailDelivery.findFirst({
    where: {
      conversation_id: payload.conversationId,
      status: { in: ["queued", "sent", "delivered"] },
      created_at: { gt: new Date(Date.now() - 10 * 60 * 1000) },
    },
  });
  if (recent) {
    await prisma.supportEmailDelivery.create({
      data: {
        conversation_id: payload.conversationId,
        message_id: payload.messageId,
        to_email: conversation.customer.email,
        status: "suppressed_rate_limit",
        last_error: "Per-conversation email frequency limit",
      },
    });
    return;
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  const replyTo = await ensureReplyTokenForEmail({
    conversationId: payload.conversationId,
    recipientUserId: payload.customerUserId,
  });

  const template = supportUnreadNotificationEmail({
    customerName: conversation.customer.name,
    subject: conversation.subject,
    preview: message.body_text,
    appUrl,
    replyTo,
  });

  await enqueueMail({
    toEmail: conversation.customer.email,
    subject: template.subject,
    htmlBody: template.html,
    textBody: template.text,
    purpose: "support.unread_notification",
    idempotencyKey: `support-unread:${payload.messageId}`,
    sensitivePayload: JSON.stringify({ replyTo }),
  });

  await prisma.supportEmailDelivery.create({
    data: {
      conversation_id: payload.conversationId,
      message_id: payload.messageId,
      to_email: conversation.customer.email,
      status: "queued",
    },
  });
}

export async function processSupportJob(job: { id: string; type: string; payload_json: unknown }) {
  try {
    if (job.type === "support.notify_unread") {
      await processNotifyUnread(job.payload_json as NotifyUnreadPayload);
    } else if (job.type === "support.campaign_deliver_batch") {
      const { deliverCampaignBatch } = await import("@/lib/support/campaigns");
      const payload = job.payload_json as { campaignId: string; cursorUserId?: string | null };
      await deliverCampaignBatch(payload.campaignId, payload.cursorUserId ?? null);
    } else {
      throw new Error(`unknown_job_type:${job.type}`);
    }
    await prisma.supportJob.update({
      where: { id: job.id },
      data: { status: "completed", last_error: null, lease_expires_at: null },
    });
    return { ok: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "job_failed";
    await prisma.supportJob.update({
      where: { id: job.id },
      data: {
        status: "pending",
        last_error: message,
        lease_expires_at: null,
        run_after: new Date(Date.now() + 30_000),
      },
    });
    return { ok: false as const, error: message };
  }
}

export async function runSupportJobBatch(limit = 10) {
  const jobs = await claimSupportJobs(limit);
  const results = [];
  for (const job of jobs) {
    results.push(await processSupportJob(job));
  }
  return { processed: jobs.length, results };
}
