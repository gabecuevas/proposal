import Link from "next/link";
import { cn } from "@repo/ui/utils";

export type BillingBannerInfo =
  | { kind: "trial"; daysLeft: number }
  | { kind: "trial_expired" }
  | { kind: "past_due" };

export function BillingBanner({ info }: { info: BillingBannerInfo }) {
  const urgent = info.kind !== "trial" || info.daysLeft <= 2;
  const message =
    info.kind === "trial"
      ? `Your free trial ends in ${info.daysLeft} day${info.daysLeft === 1 ? "" : "s"}.`
      : info.kind === "trial_expired"
        ? "Your free trial has ended. Choose a plan to keep using SendDox."
        : "We couldn't process your last payment. Update your payment method to avoid interruption.";

  return (
    <div
      role="status"
      className={cn(
        "flex shrink-0 items-center gap-3 px-4 py-2 text-sm",
        urgent ? "bg-amber-100 text-amber-950" : "bg-primary/10 text-foreground",
      )}
    >
      <span>{message}</span>
      <Link
        href="/app/settings/billing"
        className="ml-auto shrink-0 rounded-none border border-current px-3 py-1 text-xs font-semibold"
      >
        {info.kind === "past_due" ? "Update payment" : "Choose a plan"}
      </Link>
    </div>
  );
}
