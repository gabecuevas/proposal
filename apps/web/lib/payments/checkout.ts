import { prisma } from "@repo/db";
import type { InputJsonValue } from "@repo/db";
import { calculateQuoteTotals } from "../editor/quote";
import { getDocument } from "../editor/document-store";
import { getPublicAppUrl, getStripeClient } from "./stripe";

export function toMinorUnits(amount: number): number {
  return Math.max(0, Math.round(amount * 100));
}

export async function createDocumentCheckoutSession(input: {
  documentId: string;
  workspaceId: string;
  actorUserId: string;
}) {
  const document = await getDocument(input.documentId, input.workspaceId);
  if (!document) {
    throw new Error("Document not found");
  }
  if (document.status !== "SIGNED") {
    throw new Error("Document must be signed before creating checkout session");
  }

  const totals = calculateQuoteTotals(document.pricing_json);
  const amountMinor = toMinorUnits(totals.totalDueNow);
  if (amountMinor <= 0) {
    throw new Error("Document total must be greater than zero");
  }

  const currency = document.pricing_json.currency?.toLowerCase() || "usd";
  const baseUrl = getPublicAppUrl();
  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    success_url: `${baseUrl}/app?payment=success&documentId=${encodeURIComponent(document.id)}`,
    cancel_url: `${baseUrl}/app?payment=cancelled&documentId=${encodeURIComponent(document.id)}`,
    payment_method_types: ["card"],
    metadata: {
      workspaceId: input.workspaceId,
      documentId: document.id,
      actorUserId: input.actorUserId,
    },
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amountMinor,
          product_data: {
            name: `Document payment ${document.id}`,
          },
        },
      },
    ],
  });

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  const payment = await prisma.documentPayment.create({
    data: {
      workspace_id: input.workspaceId,
      document_id: document.id,
      provider: "STRIPE",
      provider_session_id: session.id,
      status: "PENDING",
      amount_minor: amountMinor,
      currency: currency.toUpperCase(),
      checkout_url: session.url,
      metadata_json: {
        createdByUserId: input.actorUserId,
      } as InputJsonValue,
    },
  });

  await prisma.documentActivityEvent.create({
    data: {
      workspace_id: input.workspaceId,
      document_id: document.id,
      event_type: "DOCUMENT_PAYMENT_CHECKOUT_CREATED",
      actor_user_id: input.actorUserId,
      metadata_json: {
        paymentId: payment.id,
        provider: "stripe",
        providerSessionId: session.id,
        amountMinor,
        currency: currency.toUpperCase(),
      },
    },
  });

  return {
    paymentId: payment.id,
    checkoutUrl: session.url,
    providerSessionId: session.id,
    amountMinor,
    currency: currency.toUpperCase(),
  };
}
