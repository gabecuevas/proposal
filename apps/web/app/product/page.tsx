export default function ProductPage() {
  const capabilities = [
    {
      title: "Template-driven docs",
      detail: "Build reusable proposals and contracts with variables, pricing blocks, and content library embeds.",
    },
    {
      title: "Approvals and controls",
      detail: "Auto-require discount approvals based on workspace policy before documents can be sent.",
    },
    {
      title: "Embedded eSignature",
      detail: "Signer sessions, field-level permissions, signing order, and immutable certificate rendering.",
    },
    {
      title: "Payments",
      detail: "Generate Stripe checkout sessions from signed documents and auto-transition status to PAID.",
    },
    {
      title: "API + webhooks",
      detail: "Operational endpoints for automation plus signed outbound event deliveries with retries.",
    },
    {
      title: "Analytics",
      detail: "Track send velocity, conversion to sign, delivery reliability, and payment outcomes in one view.",
    },
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Product</p>
      <h1 className="mt-3 text-4xl font-semibold">Built for the full document journey</h1>
      <p className="mt-4 max-w-3xl text-muted">
        DoxySign unifies document generation, negotiation, approval, signature, and payment in one
        production-ready platform for revenue and operations teams.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {capabilities.map((capability) => (
          <article key={capability.title} className="glass-card rounded-xl p-5">
            <h2 className="text-lg font-semibold">{capability.title}</h2>
            <p className="mt-2 text-sm text-muted">{capability.detail}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
