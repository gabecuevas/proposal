"use client";

import Link from "next/link";
import { useState } from "react";
import { cn } from "@repo/ui/utils";
import { PLANS, PLAN_ORDER, estimateChargeUsd, type BillingInterval } from "@/lib/billing/plans";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export function PricingTable() {
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");

  return (
    <div className="mt-10">
      <div className="flex items-center justify-center gap-3 text-sm">
        <span className={cn(billingInterval === "monthly" ? "font-semibold" : "text-muted")}>Monthly</span>
        <button
          type="button"
          role="switch"
          aria-checked={billingInterval === "annual"}
          aria-label="Bill annually"
          onClick={() => setBillingInterval((value) => (value === "monthly" ? "annual" : "monthly"))}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            billingInterval === "annual" ? "bg-primary" : "bg-slate-300",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              billingInterval === "annual" ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </button>
        <span className={cn(billingInterval === "annual" ? "font-semibold" : "text-muted")}>Annually</span>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {PLAN_ORDER.map((key) => {
          const plan = PLANS[key];
          const paid = key === "small_business" || key === "big_business";
          return (
            <article
              key={key}
              className={cn(
                "glass-card relative flex flex-col rounded-xl p-6",
                plan.highlighted && "ring-2 ring-primary",
              )}
            >
              {plan.highlighted ? (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-white">
                  Most popular
                </span>
              ) : null}
              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <p className="mt-2 min-h-12 text-sm text-muted">{plan.tagline}</p>
              <p className="mt-4 text-3xl font-bold">
                {plan.monthlyPriceUsd === null ? "Let's talk" : usd.format(plan.monthlyPriceUsd)}
              </p>
              <p className="mt-1 text-xs text-muted">{plan.priceNote}</p>
              {paid && billingInterval === "annual" ? (
                <p className="mt-1 text-xs text-muted">
                  Billed annually · {usd.format(estimateChargeUsd(key, "annual", 1))}
                  {plan.perSeat ? " per user" : ""} / year
                </p>
              ) : null}
              <Link
                href={key === "enterprise" ? "/contact" : "/signup"}
                className={cn(
                  "mt-5 block rounded-md px-4 py-2.5 text-center text-sm font-medium",
                  plan.highlighted ? "bg-primary text-white" : "border border-slate-900",
                )}
              >
                {key === "trial" ? "Start free trial" : key === "enterprise" ? "Contact us" : "Get started"}
              </Link>
              <ul className="mt-5 space-y-2 text-sm text-muted">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <span className="text-primary" aria-hidden>
                      ✓
                    </span>
                    {feature}
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
