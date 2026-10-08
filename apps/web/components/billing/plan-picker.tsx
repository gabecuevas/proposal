"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@repo/ui/utils";
import {
  BIG_BUSINESS_INCLUDED_SEATS,
  MAX_SEATS_PER_CHECKOUT,
  PLANS,
  PLAN_ORDER,
  estimateChargeUsd,
  type BillingInterval,
  type PaidPlanKey,
  type PlanKey,
} from "@/lib/billing/plans";

type PlanPickerProps = {
  context: "onboarding" | "settings";
  billingAvailable: boolean;
  currentPlan?: string | null;
  /** Called when the user picks the free trial (onboarding only). */
  onStartTrial?: () => Promise<void>;
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function PlanPicker({ context, billingAvailable, currentPlan = null, onStartTrial }: PlanPickerProps) {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [seats, setSeats] = useState(1);
  const [pending, setPending] = useState<PlanKey | null>(null);
  const [error, setError] = useState("");

  const visiblePlans = PLAN_ORDER.filter((key) => context === "onboarding" || key !== "trial");

  async function subscribe(plan: PaidPlanKey) {
    setPending(plan);
    setError("");
    const response = await fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        plan,
        interval: billingInterval,
        seats: plan === "small_business" ? seats : 1,
        context,
      }),
    });
    const payload = (await response.json().catch(() => null)) as
      | { url?: string; error?: { message?: string } }
      | null;
    if (!response.ok || !payload?.url) {
      setError(payload?.error?.message ?? "Unable to start checkout");
      setPending(null);
      return;
    }
    window.location.href = payload.url;
  }

  async function startTrial() {
    if (!onStartTrial) return;
    setPending("trial");
    setError("");
    try {
      await onStartTrial();
    } catch (trialError) {
      setError(trialError instanceof Error ? trialError.message : "Unable to start trial");
      setPending(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-center gap-3 text-sm">
        <span className={cn(billingInterval === "monthly" ? "font-semibold text-foreground" : "text-muted")}>
          Monthly
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={billingInterval === "annual"}
          aria-label="Bill annually"
          onClick={() => setBillingInterval((value) => (value === "monthly" ? "annual" : "monthly"))}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            billingInterval === "annual" ? "bg-primary" : "bg-border",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              billingInterval === "annual" ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </button>
        <span className={cn(billingInterval === "annual" ? "font-semibold text-foreground" : "text-muted")}>
          Annually
        </span>
      </div>

      {!billingAvailable ? (
        <p className="mx-auto mt-4 max-w-xl text-center text-sm text-muted">
          Paid plans are being set up. {context === "onboarding" ? "Start with the free trial for now." : ""}
        </p>
      ) : null}
      {error ? <p className="mt-4 text-center text-sm text-red-600">{error}</p> : null}

      <div
        className={cn(
          "mt-8 grid gap-4",
          visiblePlans.length === 4 ? "md:grid-cols-2 xl:grid-cols-4" : "md:grid-cols-3",
        )}
      >
        {visiblePlans.map((key) => {
          const plan = PLANS[key];
          const isCurrent = currentPlan === key;
          const paidKey = key === "small_business" || key === "big_business" ? key : null;
          return (
            <article
              key={key}
              className={cn(
                "relative flex flex-col border bg-surface p-5",
                plan.highlighted ? "border-primary shadow-sm" : "border-border",
              )}
            >
              {plan.highlighted ? (
                <span className="absolute inset-x-0 -top-px bg-primary py-1 text-center text-[11px] font-semibold uppercase tracking-wide text-primary-foreground">
                  Most popular
                </span>
              ) : null}
              <h2 className={cn("text-lg font-semibold", plan.highlighted && "mt-5")}>{plan.name}</h2>
              <p className="mt-1 min-h-10 text-sm text-muted">{plan.tagline}</p>

              <div className="mt-4">
                {plan.monthlyPriceUsd === null ? (
                  <p className="text-2xl font-semibold">Contact us</p>
                ) : (
                  <p className="text-2xl font-semibold">
                    {usd.format(plan.monthlyPriceUsd)}
                    <span className="ml-1 text-sm font-normal text-muted">USD</span>
                  </p>
                )}
                <p className="mt-1 text-xs text-muted">{plan.priceNote}</p>
                {paidKey && billingInterval === "annual" ? (
                  <p className="mt-1 text-xs text-muted">
                    Billed annually · {usd.format(estimateChargeUsd(paidKey, "annual", 1))}
                    {plan.perSeat ? " per user" : ""} / year
                  </p>
                ) : null}
              </div>

              {key === "small_business" ? (
                <label className="mt-4 flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted">Users</span>
                  <input
                    type="number"
                    min={1}
                    max={MAX_SEATS_PER_CHECKOUT}
                    value={seats}
                    onChange={(event) =>
                      setSeats(
                        Math.min(MAX_SEATS_PER_CHECKOUT, Math.max(1, Number(event.target.value) || 1)),
                      )
                    }
                    className="w-20 rounded-none border border-border bg-background px-2 py-1 text-right text-sm"
                  />
                </label>
              ) : null}
              {paidKey ? (
                <p className="mt-2 text-xs text-muted">
                  Total: {usd.format(estimateChargeUsd(paidKey, billingInterval, seats))} /{" "}
                  {billingInterval === "annual" ? "year" : "month"}
                  {key === "big_business" ? ` · ${BIG_BUSINESS_INCLUDED_SEATS} users` : ""}
                </p>
              ) : null}

              <div className="mt-5">
                {key === "trial" ? (
                  <button
                    type="button"
                    disabled={pending !== null}
                    onClick={() => void startTrial()}
                    className="w-full rounded-none border border-foreground px-4 py-2.5 text-sm font-medium hover:bg-background disabled:opacity-60"
                  >
                    {pending === "trial" ? "Starting..." : "Start free trial"}
                  </button>
                ) : key === "enterprise" ? (
                  <Link
                    href="/contact"
                    target={context === "onboarding" ? "_blank" : undefined}
                    className="block w-full rounded-none border border-foreground px-4 py-2.5 text-center text-sm font-medium hover:bg-background"
                  >
                    Contact us
                  </Link>
                ) : paidKey ? (
                  <button
                    type="button"
                    disabled={pending !== null || !billingAvailable || isCurrent}
                    onClick={() => void subscribe(paidKey)}
                    className={cn(
                      "w-full rounded-none px-4 py-2.5 text-sm font-medium disabled:opacity-60",
                      plan.highlighted
                        ? "bg-primary text-primary-foreground"
                        : "border border-foreground hover:bg-background",
                    )}
                  >
                    {isCurrent ? "Current plan" : pending === key ? "Redirecting..." : "Subscribe"}
                  </button>
                ) : null}
                <p className="mt-2 text-center text-xs text-muted">
                  {key === "trial" ? "No credit card required" : key === "enterprise" ? "Custom pricing" : "Secure checkout by Stripe"}
                </p>
              </div>

              <ul className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-primary" aria-hidden>
                      ✓
                    </span>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </div>
  );
}
