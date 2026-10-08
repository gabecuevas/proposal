"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { OnboardingProgress } from "@/components/auth/onboarding-progress";
import { PlanPicker } from "@/components/billing/plan-picker";
import { SendDoxLogo } from "@/components/brand/senddox-logo";

type ApiPayload = { redirectHint?: string; error?: { message?: string } } | null;

function PlanStep({ billingAvailable }: { billingAvailable: boolean }) {
  const searchParams = useSearchParams();
  const checkout = searchParams.get("checkout");
  const sessionId = searchParams.get("session_id");
  const [confirming, setConfirming] = useState(checkout === "success" && Boolean(sessionId));
  const [error, setError] = useState(checkout === "canceled" ? "Checkout was canceled. Pick a plan to continue." : "");
  const confirmStarted = useRef(false);

  useEffect(() => {
    if (checkout !== "success" || !sessionId || confirmStarted.current) {
      return;
    }
    confirmStarted.current = true;
    void (async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        const response = await fetch("/api/billing/checkout/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ sessionId }),
        });
        const payload = (await response.json().catch(() => null)) as ApiPayload;
        if (response.ok) {
          window.location.href = payload?.redirectHint ?? "/onboarding/team";
          return;
        }
        if (response.status !== 409) {
          setError(payload?.error?.message ?? "We couldn't confirm your payment.");
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      setConfirming(false);
      setError((current) => current || "We couldn't confirm your payment yet. Refresh this page in a moment.");
    })();
  }, [checkout, sessionId]);

  async function startTrial() {
    const response = await fetch("/api/onboarding/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ plan: "trial" }),
    });
    const payload = (await response.json().catch(() => null)) as ApiPayload;
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "Unable to start trial");
    }
    window.location.href = payload?.redirectHint ?? "/app";
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10">
      <SendDoxLogo className="mb-8 h-8" />
      <OnboardingProgress active="Plan" className="mb-6" />
      <h1 className="text-3xl font-semibold">Choose your plan</h1>
      <p className="mt-2 text-sm text-muted">
        Start free for 7 days, or subscribe now. You can change plans anytime in Settings → Billing.
      </p>
      {confirming ? (
        <p className="mt-10 text-sm text-muted">Confirming your subscription…</p>
      ) : (
        <div className="mt-8">
          {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
          <PlanPicker context="onboarding" billingAvailable={billingAvailable} onStartTrial={startTrial} />
        </div>
      )}
    </main>
  );
}

export function OnboardingPlanClient({ billingAvailable }: { billingAvailable: boolean }) {
  return (
    <Suspense fallback={null}>
      <PlanStep billingAvailable={billingAvailable} />
    </Suspense>
  );
}
