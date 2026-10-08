"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PlanPicker } from "@/components/billing/plan-picker";
import type { WorkspaceBillingState } from "@/lib/billing/workspace-billing";

type BillingClientProps = {
  billing: WorkspaceBillingState | null;
  canManage: boolean;
  billingAvailable: boolean;
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Payment past due",
  unpaid: "Unpaid",
  canceled: "Canceled",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
  paused: "Paused",
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function BillingClient({ billing, canManage, billingAvailable }: BillingClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  const sessionId = searchParams.get("session_id");
  const [notice, setNotice] = useState(
    checkout === "canceled" ? "Checkout was canceled. No changes were made." : "",
  );
  const [error, setError] = useState("");
  const [portalLoading, setPortalLoading] = useState(false);
  const confirmStarted = useRef(false);

  useEffect(() => {
    if (checkout !== "success" || !sessionId || confirmStarted.current) {
      return;
    }
    confirmStarted.current = true;
    setNotice("Confirming your subscription…");
    void (async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const response = await fetch("/api/billing/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ sessionId }),
        });
        if (response.ok) {
          setNotice("Thanks! Your subscription is active.");
          router.replace("/app/settings/billing");
          router.refresh();
          return;
        }
        if (response.status !== 409) break;
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      setNotice("Payment received. Your plan will update in a moment — refresh this page shortly.");
    })();
  }, [checkout, sessionId, router]);

  async function openPortal() {
    setPortalLoading(true);
    setError("");
    const response = await fetch("/api/billing/portal", { method: "POST", credentials: "same-origin" });
    const payload = (await response.json().catch(() => null)) as
      | { url?: string; error?: { message?: string } }
      | null;
    if (!response.ok || !payload?.url) {
      setError(payload?.error?.message ?? "Unable to open billing portal");
      setPortalLoading(false);
      return;
    }
    window.location.href = payload.url;
  }

  if (!billing) {
    return <p className="text-sm text-muted">No workspace selected.</p>;
  }

  const statusLabel = billing.subscriptionStatus
    ? (STATUS_LABELS[billing.subscriptionStatus] ?? billing.subscriptionStatus)
    : null;
  const renewal = formatDate(billing.currentPeriodEnd);
  const showPicker = canManage && !billing.hasActiveSubscription && billing.plan !== "enterprise";

  return (
    <div className="space-y-6">
      {notice ? (
        <p className="border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">{notice}</p>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="max-w-3xl rounded-none border border-border bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Current plan</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="text-lg font-semibold text-foreground">{billing.planName}</p>
          {billing.billingInterval && billing.hasActiveSubscription ? (
            <span className="text-sm text-muted">
              Billed {billing.billingInterval === "annual" ? "annually" : "monthly"}
            </span>
          ) : null}
          {statusLabel ? (
            <span
              className={
                billing.subscriptionStatus === "active"
                  ? "rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                  : "rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
              }
            >
              {statusLabel}
            </span>
          ) : null}
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Users</dt>
            <dd className="font-medium">
              {billing.seatsUsed}
              {billing.seatLimit !== null ? ` of ${billing.seatLimit}` : ""} seats used
            </dd>
          </div>
          {billing.plan === "trial" && !billing.hasActiveSubscription ? (
            <div>
              <dt className="text-muted">Trial</dt>
              <dd className="font-medium">
                {billing.trialExpired
                  ? "Ended — choose a plan to keep going"
                  : `${billing.trialDaysLeft} day${billing.trialDaysLeft === 1 ? "" : "s"} left · ends ${formatDate(billing.trialEndsAt)}`}
              </dd>
            </div>
          ) : null}
          {renewal && billing.hasActiveSubscription ? (
            <div>
              <dt className="text-muted">{billing.cancelAtPeriodEnd ? "Cancels on" : "Renews on"}</dt>
              <dd className="font-medium">{renewal}</dd>
            </div>
          ) : null}
        </dl>

        {canManage && billing.hasBillingAccount && billingAvailable ? (
          <div className="mt-5">
            <button
              type="button"
              onClick={() => void openPortal()}
              disabled={portalLoading}
              className="rounded-none bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {portalLoading ? "Opening..." : "Manage billing"}
            </button>
            <p className="mt-2 text-xs text-muted">
              Update your card, change users, download invoices, or cancel — powered by Stripe.
            </p>
          </div>
        ) : null}
        {!canManage ? (
          <p className="mt-4 text-sm text-muted">Ask a workspace owner or admin to change the plan.</p>
        ) : null}
      </section>

      {showPicker ? (
        <section>
          <h2 className="text-lg font-semibold">
            {billing.plan === "trial" ? "Upgrade your plan" : "Choose a plan"}
          </h2>
          <div className="mt-4">
            <PlanPicker context="settings" billingAvailable={billingAvailable} currentPlan={billing.plan} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
