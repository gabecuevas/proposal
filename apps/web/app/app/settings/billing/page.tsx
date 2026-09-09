import { SheetPadded } from "@/components/ui/sheet-table";

export default function BillingPage() {
  return (
    <SheetPadded>
    <div className="w-full max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Billing</h1>
        <p className="mt-2 text-sm text-muted">Plan, invoices, and payment methods for this workspace.</p>
      </div>
      <section className="rounded-xl border border-border bg-surface p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Current plan</p>
        <p className="mt-2 text-lg font-semibold text-foreground">Free</p>
        <p className="mt-1 text-sm text-muted">
          Workspace billing is not connected yet. You can still send documents on the current plan.
        </p>
        <button
          type="button"
          disabled
          className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-60"
        >
          Upgrade
        </button>
      </section>
    </div>
    </SheetPadded>
  );
}
