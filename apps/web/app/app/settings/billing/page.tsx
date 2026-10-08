import { getServerSession } from "@/lib/auth/server-session";
import { isStripeBillingConfigured } from "@/lib/billing/stripe-billing";
import { getWorkspaceBillingState } from "@/lib/billing/workspace-billing";
import { SheetPadded } from "@/components/ui/sheet-table";
import { BillingClient } from "./billing-client";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await getServerSession();
  const billing = session?.workspaceId ? await getWorkspaceBillingState(session.workspaceId) : null;
  const canManage = session?.role === "OWNER" || session?.role === "ADMIN";

  return (
    <SheetPadded>
      <div className="w-full max-w-6xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="mt-2 text-sm text-muted">Plan, invoices, and payment methods for this workspace.</p>
        </div>
        <BillingClient
          billing={billing}
          canManage={canManage}
          billingAvailable={isStripeBillingConfigured()}
        />
      </div>
    </SheetPadded>
  );
}
