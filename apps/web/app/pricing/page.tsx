const tiers = [
  {
    name: "Starter",
    price: "$39",
    details: "Small teams shipping proposals quickly.",
    points: ["Unlimited templates", "Embedded signing", "Basic analytics"],
  },
  {
    name: "Growth",
    price: "$99",
    details: "Multi-user approvals, advanced templates, and tracking.",
    points: ["CPQ discount approvals", "API keys + webhooks", "Payment workflows"],
  },
  {
    name: "Enterprise",
    price: "Custom",
    details: "SSO, advanced controls, and white-label options.",
    points: ["Security controls", "Custom domains", "Dedicated onboarding"],
  },
];

export default function PricingPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Pricing</p>
      <h1 className="mt-3 text-4xl font-semibold">Simple plans that scale with your team</h1>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {tiers.map((tier) => (
          <article key={tier.name} className="glass-card rounded-xl p-6">
            <h2 className="text-xl font-semibold">{tier.name}</h2>
            <p className="mt-2 text-3xl font-bold">{tier.price}</p>
            <p className="mt-4 text-muted">{tier.details}</p>
            <ul className="mt-4 space-y-1 text-sm text-muted">
              {tier.points.map((point) => (
                <li key={point}>- {point}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </main>
  );
}
