import Link from "next/link";

export default function Home() {
  return (
    <main className="marketing-hero">
      <section className="mx-auto w-full max-w-6xl px-6 py-20 md:py-28">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          DoxySign - Document Automation Platform
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-tight md:text-7xl">
          Beautiful documents, faster approvals, and payments that close the loop.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          DoxySign helps revenue teams move from proposal to signature to payment without switching tools.
          Build templates, automate approvals, collect eSignatures, and track outcomes with a modern workflow.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground shadow-sm transition hover:opacity-90"
            href="/signup"
          >
            Start free
          </Link>
          <Link
            className="rounded-lg border border-border px-5 py-3 font-medium transition hover:bg-surface"
            href="/login"
          >
            Login
          </Link>
          <Link
            className="rounded-lg border border-border px-5 py-3 font-medium transition hover:bg-surface"
            href="/product"
          >
            Explore product
          </Link>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <article className="glass-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Average send to sign</p>
            <p className="mt-1 text-2xl font-semibold">Under 24 hours</p>
          </article>
          <article className="glass-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Approval enforcement</p>
            <p className="mt-1 text-2xl font-semibold">Policy-driven</p>
          </article>
          <article className="glass-card rounded-xl p-4">
            <p className="text-xs uppercase tracking-wide text-muted">Payment readiness</p>
            <p className="mt-1 text-2xl font-semibold">Stripe integrated</p>
          </article>
        </div>
      </section>

      <section className="border-y border-border/70 bg-white/70">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-6 py-10 md:grid-cols-4">
          <Stat title="Templates" value="200+" />
          <Stat title="Avg. sign time" value="< 24h" />
          <Stat title="Workflow automation" value="Built-in" />
          <Stat title="Payments" value="Stripe-ready" />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 py-14">
        <h2 className="text-3xl font-semibold">Everything for your agreement lifecycle</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Feature
            title="Template Studio"
            description="Reusable templates, variable tokens, and content blocks for high-velocity proposal generation."
            href="/templates"
          />
          <Feature
            title="Approvals + eSignature"
            description="Route discounts through approvals, enforce signing order, and produce immutable audit evidence."
            href="/product"
          />
          <Feature
            title="Checkout + Analytics"
            description="Attach Stripe checkout to signed docs and monitor conversion, revenue, and delivery reliability."
            href="/app/analytics"
          />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-6 pb-16">
        <div className="glass-card rounded-2xl p-8">
          <h3 className="text-2xl font-semibold">Ready to launch your first document workflow?</h3>
          <p className="mt-2 max-w-2xl text-muted">
            Create your workspace in minutes and start sending production-grade documents today.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/signup" className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground">
              Get started
            </Link>
            <Link href="/contact" className="rounded-lg border border-border px-5 py-3 font-medium hover:bg-background">
              Talk to sales
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ title, value }: { title: string; value: string }) {
  return (
    <article className="glass-card rounded-xl p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
}

function Feature({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <article className="glass-card rounded-xl p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{description}</p>
      <Link href={href} className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
        Learn more
      </Link>
    </article>
  );
}
