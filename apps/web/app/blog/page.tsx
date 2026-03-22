export default function BlogPage() {
  const posts = [
    {
      title: "How to cut proposal cycle time by 40%",
      excerpt: "A practical playbook for template strategy, approvals, and signer UX.",
    },
    {
      title: "Operationalizing audit-ready agreements",
      excerpt: "Designing trails, evidence bundles, and retention policies for enterprise teams.",
    },
    {
      title: "From signed docs to paid revenue",
      excerpt: "Connecting checkout sessions and payment events to finance reporting.",
    },
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Blog</p>
      <h1 className="mt-3 text-4xl font-semibold">Insights for document operations teams</h1>
      <p className="mt-4 text-muted">
        Product and go-to-market insights for teams running proposals and contracts at scale.
      </p>
      <div className="mt-8 space-y-4">
        {posts.map((post) => (
          <article key={post.title} className="glass-card rounded-xl p-5">
            <h2 className="text-lg font-semibold">{post.title}</h2>
            <p className="mt-2 text-sm text-muted">{post.excerpt}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
