import { prisma } from "@repo/db";
import { getMailAdapter } from "./adapter";

export async function enqueueMail(params: {
  toEmail: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  purpose: string;
  idempotencyKey: string;
  sensitivePayload?: string | null;
  relatedTokenId?: string | null;
  supersedePurposeForEmail?: boolean;
}) {
  if (params.supersedePurposeForEmail) {
    await prisma.mailOutbox.updateMany({
      where: {
        to_email: params.toEmail.toLowerCase(),
        purpose: params.purpose,
        status: "pending",
        superseded_at: null,
      },
      data: {
        status: "superseded",
        superseded_at: new Date(),
        sensitive_payload: null,
      },
    });
  }

  return prisma.mailOutbox.upsert({
    where: { idempotency_key: params.idempotencyKey },
    create: {
      to_email: params.toEmail.toLowerCase(),
      subject: params.subject,
      html_body: params.htmlBody,
      text_body: params.textBody,
      purpose: params.purpose,
      idempotency_key: params.idempotencyKey,
      sensitive_payload: params.sensitivePayload ?? null,
      related_token_id: params.relatedTokenId ?? null,
      status: "pending",
    },
    update: {},
  });
}

export async function processPendingMail(limit = 20): Promise<{ sent: number; failed: number }> {
  const pending = await prisma.mailOutbox.findMany({
    where: {
      status: "pending",
      superseded_at: null,
      scheduled_at: { lte: new Date() },
    },
    orderBy: { created_at: "asc" },
    take: limit,
  });

  const adapter = getMailAdapter();
  let sent = 0;
  let failed = 0;

  for (const row of pending) {
    const result = await adapter.send({
      to: row.to_email,
      subject: row.subject,
      html: row.html_body,
      text: row.text_body,
    });
    if (result.accepted) {
      await prisma.mailOutbox.update({
        where: { id: row.id },
        data: {
          status: "sent",
          sent_at: new Date(),
          attempts: row.attempts + 1,
          sensitive_payload: null,
          last_error: null,
        },
      });
      sent += 1;
    } else {
      await prisma.mailOutbox.update({
        where: { id: row.id },
        data: {
          status: row.attempts + 1 >= 5 ? "failed" : "pending",
          attempts: row.attempts + 1,
          last_error: result.error ?? "send_failed",
          scheduled_at: new Date(Date.now() + Math.min(60_000 * 2 ** row.attempts, 30 * 60_000)),
        },
      });
      failed += 1;
    }
  }

  return { sent, failed };
}
