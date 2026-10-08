export type PlanKey = "trial" | "small_business" | "big_business" | "enterprise";
export type PaidPlanKey = "small_business" | "big_business";
export type BillingInterval = "monthly" | "annual";

export const TRIAL_DAYS = 7;
export const BIG_BUSINESS_INCLUDED_SEATS = 5;
export const MAX_SEATS_PER_CHECKOUT = 500;

export type PlanDefinition = {
  key: PlanKey;
  name: string;
  tagline: string;
  /** Display price in whole USD per month (per user when `perSeat`). Null = contact sales. */
  monthlyPriceUsd: number | null;
  perSeat: boolean;
  priceNote: string;
  features: string[];
  highlighted?: boolean;
};

export const PLANS: Record<PlanKey, PlanDefinition> = {
  trial: {
    key: "trial",
    name: "Free Trial",
    tagline: `Try SendDox free for ${TRIAL_DAYS} days.`,
    monthlyPriceUsd: 0,
    perSeat: false,
    priceNote: `${TRIAL_DAYS} days · single user`,
    features: [
      "Proposal and document editor",
      "E-signatures",
      "Real-time tracking and notifications",
      "Single user",
    ],
  },
  small_business: {
    key: "small_business",
    name: "Small Business",
    tagline: "For growing teams that send proposals every week.",
    monthlyPriceUsd: 49,
    perSeat: true,
    priceNote: "per user / month",
    features: [
      "Everything in Free Trial",
      "Unlimited documents",
      "Templates and content library",
      "Add as many users as you need",
    ],
  },
  big_business: {
    key: "big_business",
    name: "Big Business",
    tagline: "For established teams with shared workflows.",
    monthlyPriceUsd: 99,
    perSeat: false,
    priceNote: `per month · includes ${BIG_BUSINESS_INCLUDED_SEATS} users`,
    features: [
      "Everything in Small Business",
      `${BIG_BUSINESS_INCLUDED_SEATS} users included`,
      "Approval workflows",
      "Custom branding",
    ],
    highlighted: true,
  },
  enterprise: {
    key: "enterprise",
    name: "Enterprise Business",
    tagline: "For organizations with advanced security and scale needs.",
    monthlyPriceUsd: null,
    perSeat: false,
    priceNote: "Custom pricing",
    features: [
      "Everything in Big Business",
      "Custom user counts",
      "Dedicated onboarding",
      "Priority support",
    ],
  },
};

export const PLAN_ORDER: PlanKey[] = ["trial", "small_business", "big_business", "enterprise"];

/**
 * Stripe Price lookup keys. Each price in the Stripe dashboard must carry one of
 * these exact lookup keys so checkout can find it without hard-coded price IDs.
 */
export const STRIPE_PRICE_LOOKUP_KEYS: Record<PaidPlanKey, Record<BillingInterval, string>> = {
  small_business: {
    monthly: "small_business_monthly",
    annual: "small_business_annual",
  },
  big_business: {
    monthly: "big_business_monthly",
    annual: "big_business_annual",
  },
};

export function isPaidPlanKey(value: unknown): value is PaidPlanKey {
  return value === "small_business" || value === "big_business";
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === "monthly" || value === "annual";
}

export function planFromLookupKey(
  lookupKey: string | null | undefined,
): { plan: PaidPlanKey; interval: BillingInterval } | null {
  if (!lookupKey) {
    return null;
  }
  for (const plan of Object.keys(STRIPE_PRICE_LOOKUP_KEYS) as PaidPlanKey[]) {
    for (const interval of Object.keys(STRIPE_PRICE_LOOKUP_KEYS[plan]) as BillingInterval[]) {
      if (STRIPE_PRICE_LOOKUP_KEYS[plan][interval] === lookupKey) {
        return { plan, interval };
      }
    }
  }
  return null;
}

export function planDisplayName(plan: string | null | undefined): string {
  if (plan && plan in PLANS) {
    return PLANS[plan as PlanKey].name;
  }
  return "Free";
}

/** Estimated charge for display only; Stripe is the source of truth. */
export function estimateChargeUsd(plan: PaidPlanKey, interval: BillingInterval, seats: number): number {
  const monthly = PLANS[plan].monthlyPriceUsd ?? 0;
  const perPeriod = PLANS[plan].perSeat ? monthly * Math.max(1, seats) : monthly;
  return interval === "annual" ? perPeriod * 12 : perPeriod;
}
