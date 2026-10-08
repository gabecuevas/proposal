import { prisma } from "@repo/db";
import type Stripe from "stripe";
import { getPublicAppUrl, getStripeClient } from "@/lib/payments/stripe";
import {
  BIG_BUSINESS_INCLUDED_SEATS,
  MAX_SEATS_PER_CHECKOUT,
  STRIPE_PRICE_LOOKUP_KEYS,
  planFromLookupKey,
  type BillingInterval,
  type PaidPlanKey,
} from "./plans";

export function isStripeBillingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

const priceCache = new Map<string, { id: string; expiresAt: number }>();
const PRICE_CACHE_TTL_MS = 5 * 60_000;

export async function resolvePriceId(plan: PaidPlanKey, interval: BillingInterval): Promise<string> {
  const lookupKey = STRIPE_PRICE_LOOKUP_KEYS[plan][interval];
  const cached = priceCache.get(lookupKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.id;
  }
  const prices = await getStripeClient().prices.list({
    lookup_keys: [lookupKey],
    active: true,
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) {
    throw new Error(
      `No active Stripe price has the lookup key "${lookupKey}". Add it in the Stripe dashboard.`,
    );
  }
  priceCache.set(lookupKey, { id: price.id, expiresAt: Date.now() + PRICE_CACHE_TTL_MS });
  return price.id;
}

async function ensureStripeCustomer(params: {
  workspaceId: string;
  email: string;
}): Promise<string> {
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: params.workspaceId },
    select: { id: true, name: true, stripe_customer_id: true, business_email: true },
  });
  if (workspace.stripe_customer_id) {
    return workspace.stripe_customer_id;
  }
  const customer = await getStripeClient().customers.create(
    {
      email: workspace.business_email || params.email,
      name: workspace.name,
      metadata: { workspaceId: workspace.id },
    },
    { idempotencyKey: `workspace-customer:${workspace.id}` },
  );
  await prisma.workspace.update({
    where: { id: workspace.id },
    data: { stripe_customer_id: customer.id },
  });
  return customer.id;
}

export async function createSubscriptionCheckout(params: {
  workspaceId: string;
  email: string;
  plan: PaidPlanKey;
  interval: BillingInterval;
  seats: number;
  successPath: string;
  cancelPath: string;
}): Promise<string> {
  const [customerId, priceId] = await Promise.all([
    ensureStripeCustomer({ workspaceId: params.workspaceId, email: params.email }),
    resolvePriceId(params.plan, params.interval),
  ]);
  const perSeat = params.plan === "small_business";
  const seats = perSeat ? Math.min(Math.max(1, Math.floor(params.seats)), MAX_SEATS_PER_CHECKOUT) : 1;
  const appUrl = getPublicAppUrl();
  const separator = params.successPath.includes("?") ? "&" : "?";

  const session = await getStripeClient().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: params.workspaceId,
    line_items: [
      {
        price: priceId,
        quantity: seats,
        ...(perSeat
          ? { adjustable_quantity: { enabled: true, minimum: 1, maximum: MAX_SEATS_PER_CHECKOUT } }
          : {}),
      },
    ],
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    customer_update: { address: "auto", name: "auto" },
    subscription_data: {
      metadata: { workspaceId: params.workspaceId, plan: params.plan },
    },
    metadata: { workspaceId: params.workspaceId, plan: params.plan },
    success_url: `${appUrl}${params.successPath}${separator}session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}${params.cancelPath}`,
  });
  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }
  return session.url;
}

export async function createBillingPortalSession(params: {
  workspaceId: string;
  returnPath: string;
}): Promise<string> {
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: params.workspaceId },
    select: { stripe_customer_id: true },
  });
  if (!workspace.stripe_customer_id) {
    throw new Error("This workspace has no Stripe billing account yet.");
  }
  const session = await getStripeClient().billingPortal.sessions.create({
    customer: workspace.stripe_customer_id,
    return_url: `${getPublicAppUrl()}${params.returnPath}`,
  });
  return session.url;
}

async function resolveWorkspaceIdForSubscription(subscription: Stripe.Subscription): Promise<string | null> {
  const fromMetadata = subscription.metadata?.workspaceId;
  if (fromMetadata) {
    return fromMetadata;
  }
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const workspace = await prisma.workspace.findFirst({
    where: {
      OR: [{ stripe_subscription_id: subscription.id }, { stripe_customer_id: customerId }],
    },
    select: { id: true },
  });
  return workspace?.id ?? null;
}

/** Mirrors a Stripe subscription onto its workspace. Safe to call repeatedly. */
export async function syncSubscriptionToWorkspace(
  subscription: Stripe.Subscription,
  workspaceIdHint?: string | null,
): Promise<string | null> {
  const workspaceId = workspaceIdHint ?? (await resolveWorkspaceIdForSubscription(subscription));
  if (!workspaceId) {
    return null;
  }
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, stripe_subscription_id: true, plan_selected_at: true },
  });
  if (!workspace) {
    return null;
  }
  // Ignore events for an older subscription once a newer one is attached.
  if (
    workspace.stripe_subscription_id &&
    workspace.stripe_subscription_id !== subscription.id &&
    (subscription.status === "canceled" || subscription.status === "incomplete_expired")
  ) {
    return workspaceId;
  }

  const item = subscription.items.data[0];
  const mapped = planFromLookupKey(item?.price.lookup_key);
  const customerId =
    typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id;
  const plan = mapped?.plan ?? subscription.metadata?.plan ?? null;
  const seatLimit =
    plan === "big_business"
      ? BIG_BUSINESS_INCLUDED_SEATS
      : plan === "small_business"
        ? Math.max(1, item?.quantity ?? 1)
        : null;

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_price_id: item?.price.id ?? null,
      subscription_status: subscription.status,
      subscription_current_period_end: item?.current_period_end
        ? new Date(item.current_period_end * 1000)
        : null,
      subscription_cancel_at_period_end: Boolean(subscription.cancel_at_period_end || subscription.cancel_at),
      ...(plan ? { plan } : {}),
      ...(mapped ? { billing_interval: mapped.interval } : {}),
      ...(seatLimit !== null ? { seat_limit: seatLimit } : {}),
      ...(workspace.plan_selected_at ? {} : { plan_selected_at: new Date() }),
    },
  });
  return workspaceId;
}

/**
 * Confirms a completed Checkout session for the given workspace (used on the
 * success redirect so the user does not wait for the webhook).
 */
export async function confirmCheckoutSession(sessionId: string, workspaceId: string): Promise<boolean> {
  const session = await getStripeClient().checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });
  if (session.client_reference_id !== workspaceId || session.mode !== "subscription") {
    return false;
  }
  if (session.status !== "complete") {
    return false;
  }
  const subscription = session.subscription;
  if (!subscription || typeof subscription === "string") {
    return false;
  }
  await syncSubscriptionToWorkspace(subscription, workspaceId);
  return true;
}

export async function processSubscriptionCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription" || !session.subscription) {
    return;
  }
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription.id;
  const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId);
  await syncSubscriptionToWorkspace(subscription, session.client_reference_id);
}
