import type { NextRequest } from "next/server";
import type Stripe from "stripe";
import { errorResponse, jsonWithRequestId } from "@/lib/api/response";
import {
  processSubscriptionCheckoutCompleted,
  syncSubscriptionToWorkspace,
} from "@/lib/billing/stripe-billing";
import { getStripeClient, getStripeWebhookSecret } from "@/lib/payments/stripe";
import {
  processStripeCheckoutCompleted,
  processStripeCheckoutExpired,
} from "@/lib/payments/webhook";

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return errorResponse(request, {
      status: 400,
      code: "validation_error",
      message: "Missing stripe-signature header",
    });
  }

  let event;
  try {
    const payload = await request.text();
    event = getStripeClient().webhooks.constructEvent(payload, signature, getStripeWebhookSecret());
  } catch (error) {
    return errorResponse(request, {
      status: 400,
      code: "invalid_webhook_signature",
      message: error instanceof Error ? error.message : "Invalid Stripe webhook signature",
    });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription") {
        await processSubscriptionCheckoutCompleted(session);
      } else {
        await processStripeCheckoutCompleted(event);
      }
    } else if (event.type === "checkout.session.expired") {
      await processStripeCheckoutExpired(event);
    } else if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      await syncSubscriptionToWorkspace(event.data.object as Stripe.Subscription);
    }
  } catch (error) {
    return errorResponse(request, {
      status: 500,
      code: "webhook_processing_failed",
      message: error instanceof Error ? error.message : "Failed to process Stripe webhook",
    });
  }

  return jsonWithRequestId(request, { received: true });
}
