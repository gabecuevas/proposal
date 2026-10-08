import { PricingTable } from "./pricing-table";

export default function PricingPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Pricing</p>
      <h1 className="mt-3 text-4xl font-semibold">Simple plans that scale with your team</h1>
      <p className="mt-3 text-muted">Start with a 7-day free trial. No credit card required.</p>
      <PricingTable />
    </main>
  );
}
