export default function ContactPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Contact</p>
      <h1 className="mt-3 text-4xl font-semibold">Talk to our team</h1>
      <p className="mt-4 text-muted">Talk to our team about migration, onboarding, and production rollout.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="glass-card rounded-xl p-5">
          <h2 className="font-semibold">Sales</h2>
          <p className="mt-2 text-sm text-muted">sales@doxysign.app</p>
        </article>
        <article className="glass-card rounded-xl p-5">
          <h2 className="font-semibold">Support</h2>
          <p className="mt-2 text-sm text-muted">support@doxysign.app</p>
        </article>
      </div>
    </main>
  );
}
