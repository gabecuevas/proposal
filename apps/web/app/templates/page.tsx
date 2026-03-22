import Link from "next/link";

const templates = [
  { name: "Sales Proposal", desc: "Scope, pricing, and eSignature fields prewired." },
  { name: "MSA + Order Form", desc: "Legal-first structure with approval routing." },
  { name: "NDA", desc: "Fast bilateral/non-bilateral confidentiality package." },
  { name: "Renewal Quote", desc: "One-click update for existing customer expansions." },
  { name: "SOW", desc: "Project phases, deliverables, and sign-off blocks." },
];

export default function TemplatesPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-16">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Templates</p>
      <h1 className="mt-3 text-4xl font-semibold">Launch faster with proven starting points</h1>
      <Link
        href="/templates/new"
        className="mt-5 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        Create template
      </Link>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <article key={template.name} className="glass-card rounded-xl p-5">
            <h2 className="font-semibold">{template.name}</h2>
            <p className="mt-2 text-sm text-muted">{template.desc}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
