import { isStripeBillingConfigured } from "@/lib/billing/stripe-billing";
import { OnboardingPlanClient } from "./plan-client";

export default function OnboardingPlanPage() {
  return <OnboardingPlanClient billingAvailable={isStripeBillingConfigured()} />;
}
