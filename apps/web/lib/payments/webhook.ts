import { prisma } from "@repo/db";
import type Stripe from "stripe";
import { markDocumentPaid } from "@/lib/editor/document-store";
import { enqueueWebhookEvent } from "@/lib/webhooks/queue";

export async function processStripeCheckoutCompleted(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const payment = await prisma.documentPayment.findUnique({
    where: { provider_session_id: session.id },
  });
  if (!payment) {
    return;
  }
  if (payment.status === "COMPLETED") {
    return;
  }
  const paidAt = new Date();
  await prisma.documentPayment.update({
    where: { id: payment.id },
    data: {
      status: "COMPLETED",
      paid_at: paidAt,
      metadata_json: {
        stripePaymentIntentId:
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id ?? null,
      },
    },
  });

  await markDocumentPaid({
    documentId: payment.document_id,
    workspaceId: payment.workspace_id,
    paymentId: payment.id,
    provider: "stripe",
    providerSessionId: session.id,
    amountMinor: payment.amount_minor,
    currency: payment.currency,
  });

  await enqueueWebhookEvent({
    workspaceId: payment.workspace_id,
    eventType: "document.paid",
    documentId: payment.document_id,
    correlationId: `stripe:${event.id}`,
    payload: {
      type: "document.paid",
      document: {
        id: payment.document_id,
        status: "PAID",
      },
      payment: {
        id: payment.id,
        provider: "stripe",
        providerSessionId: session.id,
        amountMinor: payment.amount_minor,
        currency: payment.currency,
      },
      occurredAt: paidAt.toISOString(),
    },
  }).catch(() => {});
}

export async function processStripeCheckoutExpired(event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;
  const payment = await prisma.documentPayment.findUnique({
    where: { provider_session_id: session.id },
  });
  if (!payment || payment.status !== "PENDING") {
    return;
  }
  await prisma.documentPayment.update({
    where: { id: payment.id },
    data: {
      status: "EXPIRED",
    },
  });
}
